/**
 * Diagnostic script to test Anthropic API connectivity
 * Run: node test-anthropic.cjs
 */

const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.ANTHROPIC_API_KEY;

console.log('=== Anthropic API Diagnostic ===\n');

// Check 1: API Key exists
if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY not found in .env.local');
    console.log('\n📝 To fix:');
    console.log('1. Create an API key at: https://console.anthropic.com/');
    console.log('2. Add to .env.local: ANTHROPIC_API_KEY=sk-ant-api03-...');
    process.exit(1);
}

console.log('✅ ANTHROPIC_API_KEY found');
console.log(`   Format: ${apiKey.substring(0, 15)}...${apiKey.substring(apiKey.length - 4)}`);

// Check 2: API Key format
if (!apiKey.startsWith('sk-ant-')) {
    console.error('⚠️  Warning: API key should start with "sk-ant-"');
}

// Check 3: Test API connection
console.log('\n🔄 Testing API connection...');

const client = new Anthropic({
    apiKey: apiKey,
});

async function testConnection() {
    try {
        const message = await client.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 100,
            messages: [
                { role: 'user', content: 'Responde solo con "OK" si puedes leerme.' }
            ],
        });

        console.log('✅ API connection successful!');
        console.log(`   Model: ${message.model}`);
        console.log(`   Response: ${message.content[0].text}`);
        console.log('\n✨ Your Anthropic API is working correctly!');
        console.log('\n📝 Next steps:');
        console.log('   1. Restart your dev server: npm run dev');
        console.log('   2. Test with "Tengo pena" to see the AI question loop');

    } catch (error) {
        console.error('❌ API connection failed!');
        console.error(`   Error: ${error.message}`);

        if (error.status === 401) {
            console.log('\n📝 Error 401 - Unauthorized');
            console.log('   Your API key is invalid or expired');
            console.log('   Solution: Generate a new key at https://console.anthropic.com/');
        } else if (error.status === 429) {
            console.log('\n📝 Error 429 - Rate Limit');
            console.log('   You have exceeded your API quota');
            console.log('   Solution: Check your usage at https://console.anthropic.com/');
        } else if (error.status === 403) {
            console.log('\n📝 Error 403 - Forbidden');
            console.log('   Your account may not have access to this model');
            console.log('   Solution: Verify account status at https://console.anthropic.com/');
        } else {
            console.log('\n📝 Unexpected error');
            console.log('   Check your internet connection and try again');
        }

        process.exit(1);
    }
}

testConnection();
