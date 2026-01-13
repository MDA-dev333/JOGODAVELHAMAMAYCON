// =============================================
// CONFIGURAÇÃO DO SUPABASE
// =============================================
// INSTRUÇÕES:
// 1. Crie uma conta em https://supabase.com
// 2. Crie um novo projeto
// 3. Vá em Settings > API
// 4. Copie a URL e a anon/public key
// 5. Cole abaixo
// =============================================

window.SUPABASE_CONFIG = {
    // SUA URL DO SUPABASE (ex: https://abc123.supabase.co)
    url: "COLE_SUA_URL_AQUI",
    
    // SUA CHAVE PÚBLICA (anon/public key)
    key: "COLE_SUA_CHAVE_AQUI"
};

// =============================================
// NÃO EDITE ABAIXO DESTA LINHA
// =============================================

console.log('Configuração do Supabase carregada.');
console.log('URL configurada:', window.SUPABASE_CONFIG.url ? '✅' : '❌');
console.log('Chave configurada:', window.SUPABASE_CONFIG.key ? '✅' : '❌');

if (!window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.key) {
    console.error('❌ CONFIGURAÇÃO INCOMPLETA!');
    console.error('Edite o arquivo supabase-config.js com suas credenciais do Supabase');
}