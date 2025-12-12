import bcrypt from 'bcryptjs';

async function generateHash() {
    const password = process.argv[2] || 'NewAdmin2024!';
    const hash = await bcrypt.hash(password, 10);

    console.log('✅ Хэш пароля сгенерирован:');
    console.log('🔑 Пароль:', password);
    console.log('🔐 Хэш:', hash);
    console.log('\nСкопируйте хэш и вставьте в update-admin-password.js');
}

generateHash();
