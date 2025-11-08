#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function updateSupabaseConfig() {
  console.log('🔄 Supabase Database Update Tool');
  console.log('================================\n');

  try {
    // Read current .env file
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      console.log('📄 Current configuration:');
      console.log(envContent);
      console.log();
    }

    // Get new credentials
    const newUrl = await question('Enter new Supabase Project URL: ');
    const newKey = await question('Enter new Supabase Anon Key: ');

    if (!newUrl || !newKey) {
      console.log('❌ Both URL and Key are required!');
      process.exit(1);
    }

    // Validate URL format
    if (!newUrl.startsWith('https://') || !newUrl.includes('.supabase.co')) {
      console.log('❌ Invalid Supabase URL format!');
      process.exit(1);
    }

    // Update .env file
    const newEnvContent = `VITE_SUPABASE_URL=${newUrl}
VITE_SUPABASE_ANON_KEY=${newKey}`;

    fs.writeFileSync(envPath, newEnvContent);

    console.log('\n✅ Supabase configuration updated successfully!');
    console.log('📝 New configuration:');
    console.log(newEnvContent);
    console.log('\n🔄 Please restart your development server to apply changes.');
    console.log('💡 Run: npm run dev');

  } catch (error) {
    console.error('❌ Error updating configuration:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

updateSupabaseConfig();