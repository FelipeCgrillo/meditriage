#!/usr/bin/env python3
"""
Saneamiento del archivo DAU entregado por el HMS (estudio CEC-E-319).

Objetivo: dejar solo los registros que cumplen los criterios de la tesis y
reducir cada uno a los campos que el CEC autorizó (sexo, tramo etario
quinquenal, mes y año, franja horaria, motivo de consulta, categoría TENS y
destino al egreso). Elimina fecha de nacimiento, edad exacta, fechas y horas
exactas, tipo de urgencia, procedencia y egreso.

Uso:
    python3 -I scripts/sanear_dau.py ENTRADA.csv SALIDA_DIR [--excluir-dental] [--solo-espontaneo] [--desde=AAAA-MM-DD]

Opciones:
    --excluir-dental    descarta la urgencia dental (no se triagea con ESI: 46 % sin categoría)
    --desde=AAAA-MM-DD  descarta atenciones anteriores a esa fecha (el campo Destino no está registrado
                        antes de fines de noviembre de 2024: 0 hospitalizaciones y 0 traslados en 9 meses)
    --solo-espontaneo   descarta la procedencia "Espontáneo HMS" y deja solo "Espontáneo"
                        (para el caso de que el HMS confirme que "HMS" indica población institucional)

Escribe en SALIDA_DIR:
    dau_saneado.csv        registros que pasan todos los criterios
    informe_saneamiento.md conteos por regla (sin datos de pacientes)
    informe_saneamiento.json

Principios:
  - Cada fila se descarta por la PRIMERA regla que incumple, en el orden de la
    lista RULES, de modo que los conteos suman exactamente lo eliminado.
  - Nada de lo impreso o guardado en el informe contiene texto de pacientes.
  - La edad se calcula al momento de la atención (FechaIngreso menos FechaNac).
    La columna Edad del archivo NO sirve: es la edad actual a la fecha de
    extracción, no la que tenía el paciente al atenderse.
"""
import collections
import csv
import datetime
import json
import os
import random
import re
import sys

SEED = 20261117
EXTRACTION_DATE = datetime.date(2026, 11, 20)  # la columna Edad coincide con esta fecha
K_ANON = 5
MAX_AGE = 105

VALID_CATS = {
    'C1 - Urgencia Vital',
    'C2 - Emergencia',
    'C3 - Urgencia',
    'C4 - Complejidad Baja',
    'C5 - Mínima Complejidad',
}
SPONTANEOUS = {'Espontáneo', 'Espontáneo HMS'}
PEDIATRIC_TYPES = {'General Pediatrico', 'Respiratoria Pediatrico', 'Traumatología Pediatrico', 'Cirugia Pediatrico'}
OTHER_SERVICES = {'Obstétrico', 'Ginecologico', 'Telemedicina'}

DATE = re.compile(r'^(\d{1,2})-(\d{1,2})-(\d{2,4})$')
TIME = re.compile(r'^(\d{1,2}):(\d{2})(?::\d{2})?$')


def plain(s):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if unicodedata.category(c) != 'Mn')


def parse_date(s, ref_year=None):
    m = DATE.match(s.strip())
    if not m:
        return None
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if y < 100:
        y = 2000 + y if (ref_year is None or y <= ref_year % 100) else 1900 + y
    try:
        return datetime.date(y, mo, d)
    except ValueError:
        return None


def kind(v):
    v = v.strip()
    if v == '':
        return 'E'
    if DATE.match(v):
        return 'D'
    if TIME.match(v):
        return 'H'
    if re.fullmatch(r'\d{1,3}', v):
        return 'N'
    return 'T'


def classify_outcome(destino):
    """Devuelve (categoria, motivo_exclusion). categoria: alta, hospitalizacion, traslado, fallecimiento."""
    v = plain(destino.strip())
    if v in ('', '(null)', 'null'):
        return None, 'destino ausente'
    if DATE.match(v) or TIME.match(v):
        return None, 'destino ausente'
    if re.search(r'cadaver|anatomia patologica|servicio medico legal|\bsml\b|fallec|defunc', v):
        return 'fallecimiento', None
    if re.search(r'hospitaliz', v):
        return 'hospitalizacion', None
    if re.search(r'trasl|otro centro|derivacion hospital', v):
        return 'traslado', None
    if v == 'domicilio':
        return 'alta', None
    # Retiro bajo propio riesgo, derivación interna, policía, "otros", desconocido:
    # el desenlace no se puede clasificar con certeza.
    return None, 'destino no clasificable'


def age_band(age):
    if age >= 80:
        return '80+'
    lo = (age // 5) * 5
    return f'{lo}-{lo + 4}'


def time_band(h):
    if h < 6:
        return '00-06'
    if h < 12:
        return '06-12'
    if h < 18:
        return '12-18'
    return '18-24'


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = {a for a in sys.argv[1:] if a.startswith('--')}
    if len(args) != 2:
        print(__doc__)
        sys.exit(2)
    src, outdir = args
    exclude_dental = '--excluir-dental' in flags
    only_spont = '--solo-espontaneo' in flags
    desde = None
    for a in sys.argv[1:]:
        if a.startswith('--desde='):
            y, m, d = (int(x) for x in a.split('=', 1)[1].split('-'))
            desde = datetime.date(y, m, d)
    os.makedirs(outdir, exist_ok=True)

    with open(src, encoding='utf-8-sig', newline='') as f:
        reader = csv.reader(f, delimiter=';')
        header = next(reader)
        rows = list(reader)
    idx = {h.strip(): i for i, h in enumerate(header) if h.strip()}
    need = ['Urgencia', 'TipoUrgencia', 'Sexo', 'FechaNac', 'Edad', 'FechaIngreso', 'HorIngresoAdm',
            'MotivoConsultaAdm', 'Procedencia', 'Categorizacion', 'Destino']
    missing = [n for n in need if n not in idx]
    if missing:
        sys.exit(f'Faltan columnas: {missing}')

    def g(r, name):
        i = idx[name]
        return r[i].strip() if i < len(r) else ''

    removed = collections.OrderedDict()
    kept = []
    seen = set()

    def drop(reason):
        removed[reason] = removed.get(reason, 0) + 1

    for r in rows:
        # 1) estructura: las columnas deben contener el tipo de dato esperado
        ok_struct = (
            kind(g(r, 'FechaNac')) == 'D' and kind(g(r, 'Edad')) == 'N' and kind(g(r, 'FechaIngreso')) == 'D'
            and kind(g(r, 'HorIngresoAdm')) == 'H' and kind(g(r, 'Procedencia')) in ('T', 'E')
            and (g(r, 'Categorizacion') in VALID_CATS or g(r, 'Categorizacion') == '')
        )
        if 'FechaEgreso' in idx and 'HoraEgreso' in idx:
            ok_struct = ok_struct and kind(g(r, 'FechaEgreso')) == 'D' and kind(g(r, 'HoraEgreso')) == 'H'
        if not ok_struct:
            drop('01 estructura corrida (campos desplazados)')
            continue
        motivo = g(r, 'MotivoConsultaAdm')
        if re.search(r'\b(dato|registro|paciente) de prueba\b', plain(motivo)):
            drop('02 registro de prueba')
            continue
        key = tuple(x.strip() for x in r[:13])
        if key in seen:
            drop('03 duplicado exacto')
            continue
        seen.add(key)
        urg, tipo = g(r, 'Urgencia'), g(r, 'TipoUrgencia')
        if urg == 'Urgencia Pediatrica' or tipo in PEDIATRIC_TYPES:
            drop('04 urgencia pediátrica')
            continue
        if tipo in OTHER_SERVICES:
            drop('05 urgencia obstétrica, ginecológica o telemedicina')
            continue
        if exclude_dental and tipo == 'Dental':
            drop('06 urgencia dental (opcional)')
            continue
        proc = g(r, 'Procedencia')
        if proc not in SPONTANEOUS:
            drop('07 consulta no espontánea')
            continue
        if only_spont and proc != 'Espontáneo':
            drop('07 procedencia "Espontáneo HMS" (opcional)')
            continue
        sexo = g(r, 'Sexo')
        if sexo not in ('Hombre', 'Mujer'):
            drop('08 sexo indeterminado o desconocido')
            continue
        di = parse_date(g(r, 'FechaIngreso'), 2026)
        dn = parse_date(g(r, 'FechaNac'), di.year if di else 2026)
        if not di or not dn:
            drop('09 fecha inválida')
            continue
        if desde and di < desde:
            drop('09 atención anterior al período con destino registrado')
            continue
        age_at_care = di.year - dn.year - ((di.month, di.day) < (dn.month, dn.day))
        age_now = EXTRACTION_DATE.year - dn.year - ((EXTRACTION_DATE.month, EXTRACTION_DATE.day) < (dn.month, dn.day))
        if age_at_care < 0 or abs(int(g(r, 'Edad')) - age_now) > 1:
            drop('09 fecha de nacimiento inconsistente con la edad')
            continue
        if age_at_care > MAX_AGE:
            drop('10 edad mayor a 105 años')
            continue
        if age_at_care < 18:
            drop('11 menor de 18 años al momento de la atención')
            continue
        if len(re.findall(r'[A-Za-zÁÉÍÓÚÑáéíóúñ]', motivo)) < 3:
            drop('12 motivo de consulta sin contenido')
            continue
        cat = g(r, 'Categorizacion')
        if cat not in VALID_CATS:
            drop('13 categoría TENS ausente o inválida')
            continue
        outcome, why = classify_outcome(g(r, 'Destino'))
        if outcome is None:
            drop('14 ' + why)
            continue
        hm = TIME.match(g(r, 'HorIngresoAdm'))
        hour = int(hm.group(1)) if hm else None
        if hour is None or hour > 23:
            drop('09 hora inválida')
            continue
        kept.append({
            'sexo': 'M' if sexo == 'Hombre' else 'F',
            'tramo_etario': age_band(age_at_care),
            'mes_anio': f'{di.year}-{di.month:02d}',
            'franja_horaria': time_band(hour),
            'motivo_consulta': re.sub(r'\s+', ' ', motivo).strip(),
            'categoria_tens': cat,
            'destino': {'alta': 'Domicilio', 'hospitalizacion': 'Hospitalización', 'traslado': 'Traslado',
                        'fallecimiento': 'Fallecimiento'}[outcome],
            'destino_original': g(r, 'Destino'),
            '_tipo': tipo,
        })

    # 15) k-anonimato sobre (tramo, sexo, mes, franja)
    combos = collections.Counter((k['tramo_etario'], k['sexo'], k['mes_anio'], k['franja_horaria']) for k in kept)
    final = []
    for k in kept:
        if combos[(k['tramo_etario'], k['sexo'], k['mes_anio'], k['franja_horaria'])] < K_ANON:
            drop(f'15 anonimato k menor a {K_ANON}')
        else:
            final.append(k)

    rng = random.Random(SEED)
    rng.shuffle(final)  # rompe el orden cronológico del archivo original
    cols = ['id', 'sexo', 'tramo_etario', 'mes_anio', 'franja_horaria', 'motivo_consulta', 'categoria_tens',
            'destino', 'destino_original']
    out_csv = os.path.join(outdir, 'dau_saneado.csv')
    with open(out_csv, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f, quoting=csv.QUOTE_ALL, lineterminator='\n')
        w.writerow(cols)
        for i, k in enumerate(final, start=1):
            w.writerow([f'r{i:06d}'] + [k[c] for c in cols[1:]])

    total = len(rows)
    out_cnt = collections.Counter(k['destino'] for k in final)
    high = sum(out_cnt[o] for o in ('Hospitalización', 'Traslado', 'Fallecimiento'))
    cat_cnt = collections.Counter(k['categoria_tens'][:2] for k in final)
    dental = sum(1 for k in final if k['_tipo'] == 'Dental')
    report = {
        'archivo_original_registros': total,
        'registros_saneados': len(final),
        'eliminados_total': total - len(final),
        'excluir_dental': exclude_dental,
        'solo_espontaneo': only_spont,
        'eliminados_por_regla': dict(sorted(removed.items())),
        'desenlace': dict(out_cnt),
        'alta_gravedad': high,
        'prevalencia_alta_gravedad': round(high / len(final), 4) if final else None,
        'criticos_fallecimiento': out_cnt['Fallecimiento'],
        'categoria_tens': dict(sorted(cat_cnt.items())),
        'dental_en_saneado': dental,
        'tamano_muestra_para_73_graves': (int(73 / (high / len(final)) * 1.15) + 1) if high else None,
        'semilla': SEED,
        'k_anonimato': K_ANON,
    }
    assert sum(removed.values()) == total - len(final), 'los conteos no cuadran'
    with open(os.path.join(outdir, 'informe_saneamiento.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    lines = ['# Informe de saneamiento del archivo DAU', '',
             f'- Registros en el archivo original: **{total:,}**'.replace(',', '.'),
             f'- Registros que cumplen los criterios: **{len(final):,}**'.replace(',', '.'),
             f'- Eliminados: **{total - len(final):,}**'.replace(',', '.'), '',
             '## Eliminados por regla (cada fila cuenta en la primera regla que incumple)', '',
             '| Regla | Registros |', '|---|---|']
    for k, v in sorted(removed.items()):
        lines.append(f'| {k} | {v:,} |'.replace(',', '.'))
    lines += ['', '## Archivo saneado', '', '| Desenlace | Registros |', '|---|---|']
    for k, v in out_cnt.most_common():
        lines.append(f'| {k} | {v:,} |'.replace(',', '.'))
    lines += ['', f'Alta gravedad: {high:,} ({report["prevalencia_alta_gravedad"] * 100:.2f} %). '
              f'Críticos (fallecimiento): {out_cnt["Fallecimiento"]}.'.replace(',', '.'),
              f'Muestra necesaria para esperar 73 casos graves: unos {report["tamano_muestra_para_73_graves"]:,}.'.replace(',', '.')]
    with open(os.path.join(outdir, 'informe_saneamiento.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')

    print(f'Original: {total}  Saneado: {len(final)}  Eliminados: {total - len(final)}')
    for k, v in sorted(removed.items()):
        print(f'  {v:>7}  {k}')
    print('Desenlace:', dict(out_cnt), '| alta gravedad', high, f'({report["prevalencia_alta_gravedad"] * 100:.2f} %)')
    print('Categoría TENS:', dict(sorted(cat_cnt.items())), '| dental en el saneado:', dental)
    print('Muestra necesaria para ~73 graves:', report['tamano_muestra_para_73_graves'])


if __name__ == '__main__':
    main()
