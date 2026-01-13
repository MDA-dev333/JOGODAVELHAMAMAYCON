// =============================================
// JOGO DA VELHA ONLINE - MULTIPLAYER
// Usando Supabase para tempo real
// =============================================

// Variáveis globais
let supabase = null;
let roomId = null;
let playerSymbol = null;
let playerName = null;
let playerId = null;
let currentRoomSubscription = null;
let isMyTurn = false;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando jogo...');
    
    // Gerar ID único para o jogador
    playerId = 'player_' + Math.random().toString(36).substr(2, 9);
    
    // Configurar Supabase
    initializeSupabase();
    
    // Criar tabuleiro
    createBoard();
    
    // Configurar event listeners
    setupEventListeners();
    
    // Pedir nome do jogador
    setTimeout(() => {
        askPlayerName();
    }, 500);
});

// Inicializar Supabase
function initializeSupabase() {
    if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.key) {
        console.error('Configuração do Supabase não encontrada!');
        document.getElementById('status-text').innerHTML = 
            '❌ <strong>Erro de configuração:</strong><br>' +
            'Edite o arquivo supabase-config.js com suas credenciais do Supabase';
        return;
    }
    
    try {
        supabase = window.supabase.createClient(
            window.SUPABASE_CONFIG.url,
            window.SUPABASE_CONFIG.key
        );
        console.log('Supabase inicializado com sucesso!');
        document.getElementById('status-text').textContent = '✅ Conectado! Escolha uma opção:';
    } catch (error) {
        console.error('Erro ao inicializar Supabase:', error);
        document.getElementById('status-text').textContent = '❌ Erro ao conectar com o servidor';
    }
}

// Perguntar nome do jogador
function askPlayerName() {
    const defaultName = 'Jogador' + Math.floor(Math.random() * 1000);
    const name = prompt('Digite seu nome para o jogo:', defaultName);
    
    if (name && name.trim() !== '') {
        playerName = name.trim();
    } else {
        playerName = defaultName;
    }
    
    console.log('Jogador:', playerName);
    addSystemMessage(`Bem-vindo, ${playerName}!`);
}

// Configurar listeners dos botões
function setupEventListeners() {
    // Botão Criar Sala
    document.getElementById('start-btn').addEventListener('click', createRoom);
    
    // Botão Listar Salas
    document.getElementById('list-rooms-btn').addEventListener('click', listAvailableRooms);
    
    // Botão Entrar na Sala (pelo input)
    document.getElementById('join-btn').addEventListener('click', () => {
        const code = document.getElementById('room-code-input').value.trim();
        if (code) {
            joinRoomByCode(code);
        }
    });
    
    // Entrar com Enter no input
    document.getElementById('room-code-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const code = document.getElementById('room-code-input').value.trim();
            if (code) {
                joinRoomByCode(code);
            }
        }
    });
}

// =============================================
// FUNÇÕES DE SALA
// =============================================

// Criar uma nova sala
async function createRoom() {
    if (!supabase) {
        alert('Supabase não configurado! Configure o arquivo supabase-config.js');
        return;
    }
    
    try {
        // Gerar código da sala (4 letras/números)
        roomId = generateRoomCode();
        
        // Criar sala no banco de dados
        const { data, error } = await supabase
            .from('rooms')
            .insert([{
                id: roomId,
                player1: playerName,
                player2: null,
                current_player: 'X',
                board: ',,,,,,,,',
                status: 'waiting',
                created_at: new Date().toISOString()
            }]);
        
        if (error) {
            console.error('Erro ao criar sala:', error);
            alert('Erro ao criar sala: ' + error.message);
            return;
        }
        
        // Configurar jogador como X
        playerSymbol = 'X';
        isMyTurn = true;
        
        // Atualizar interface
        updatePlayerNames();
        document.getElementById('status-text').innerHTML = 
            `🎯 <strong>Sala criada!</strong><br>Código: <span style="color: #6f42c1; font-size: 1.2em;">${roomId}</span>`;
        document.getElementById('room-id').innerHTML = 
            `Compartilhe este código: <strong>${roomId}</strong>`;
        
        // Desabilitar botão de criar sala
        document.getElementById('start-btn').disabled = true;
        document.getElementById('start-btn').innerHTML = '⏳ Aguardando jogador...';
        
        // Inscrever para atualizações em tempo real
        subscribeToRoom(roomId);
        
        // Adicionar mensagem no chat
        addSystemMessage(`Sala ${roomId} criada! Aguardando oponente...`);
        
        console.log(`Sala ${roomId} criada com sucesso!`);
        
    } catch (error) {
        console.error('Erro ao criar sala:', error);
        alert('Erro inesperado ao criar sala.');
    }
}

// Listar salas disponíveis
async function listAvailableRooms() {
    if (!supabase) {
        alert('Supabase não configurado!');
        return;
    }
    
    try {
        // Buscar salas que estão esperando jogador
        const { data: rooms, error } = await supabase
            .from('rooms')
            .select('id, player1, created_at')
            .eq('status', 'waiting')
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) {
            console.error('Erro ao buscar salas:', error);
            return;
        }
        
        if (!rooms || rooms.length === 0) {
            alert('Nenhuma sala disponível no momento.\nCrie uma nova sala!');
            return;
        }
        
        // Formatar lista de salas
        let roomsList = '🏆 Salas Disponíveis:\n\n';
        rooms.forEach((room, index) => {
            const timeAgo = getTimeAgo(room.created_at);
            roomsList += `${index + 1}. Sala: ${room.id}\n   Criada por: ${room.player1}\n   (${timeAgo})\n\n`;
        });
        roomsList += 'Digite o código da sala para entrar.';
        
        // Mostrar popup com as salas
        const roomCode = prompt(roomsList);
        if (roomCode && roomCode.trim() !== '') {
            joinRoomByCode(roomCode.trim().toUpperCase());
        }
        
    } catch (error) {
        console.error('Erro ao listar salas:', error);
    }
}

// Entrar em uma sala existente
async function joinRoomByCode(code) {
    if (!supabase) {
        alert('Supabase não configurado!');
        return;
    }
    
    if (!code || code.length !== 4) {
        alert('Código inválido! O código deve ter 4 caracteres.');
        return;
    }
    
    try {
        // Verificar se a sala existe
        const { data: room, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', code)
            .single();
        
        if (error || !room) {
            alert('Sala não encontrada! Verifique o código.');
            return;
        }
        
        // Verificar status da sala
        if (room.status === 'playing') {
            alert('Esta sala já está com jogo em andamento!');
            return;
        }
        
        if (room.status === 'finished') {
            alert('Esta sala já finalizou o jogo!');
            return;
        }
        
        // Verificar se a sala já tem 2 jogadores
        if (room.player1 && room.player2) {
            alert('Sala cheia! Esta sala já tem 2 jogadores.');
            return;
        }
        
        // Entrar na sala
        roomId = code;
        playerSymbol = 'O'; // Segundo jogador é O
        isMyTurn = false;
        
        // Atualizar sala no banco de dados
        const { error: updateError } = await supabase
            .from('rooms')
            .update({
                player2: playerName,
                status: 'playing',
                updated_at: new Date().toISOString()
            })
            .eq('id', roomId);
        
        if (updateError) {
            console.error('Erro ao entrar na sala:', updateError);
            alert('Erro ao entrar na sala.');
            return;
        }
        
        // Atualizar interface
        updatePlayerNames();
        document.getElementById('status-text').innerHTML = 
            `✅ <strong>Conectado à sala ${roomId}!</strong><br>Aguardando jogada do adversário...`;
        document.getElementById('room-id').innerHTML = 
            `Sala: <strong>${roomId}</strong>`;
        
        // Limpar input
        document.getElementById('room-code-input').value = '';
        
        // Desabilitar botões de criar/entrar
        document.getElementById('start-btn').disabled = true;
        document.getElementById('list-rooms-btn').disabled = true;
        document.getElementById('join-btn').disabled = true;
        document.getElementById('room-code-input').disabled = true;
        
        // Inscrever para atualizações em tempo real
        subscribeToRoom(roomId);
        
        // Adicionar mensagem no chat
        addSystemMessage(`Entrou na sala ${roomId} como Jogador O`);
        addSystemMessage(`Jogador X: ${room.player1}`);
        
        console.log(`Entrou na sala ${roomId} como Jogador O`);
        
    } catch (error) {
        console.error('Erro ao entrar na sala:', error);
        alert('Erro ao entrar na sala: ' + error.message);
    }
}

// Inscrever para atualizações em tempo real da sala
function subscribeToRoom(roomId) {
    if (!supabase || !roomId) return;
    
    // Cancelar inscrição anterior se existir
    if (currentRoomSubscription) {
        supabase.removeChannel(currentRoomSubscription);
    }
    
    console.log(`Inscrevendo para atualizações da sala: ${roomId}`);
    
    // Inscrever na tabela rooms
    currentRoomSubscription = supabase
        .channel(`room:${roomId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'rooms',
                filter: `id=eq.${roomId}`
            },
            handleRoomUpdate
        )
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `room_id=eq.${roomId}`
            },
            handleNewMessage
        )
        .subscribe((status) => {
            console.log(`Status da inscrição: ${status}`);
        });
}

// =============================================
// FUNÇÕES DO JOGO
// =============================================

// Criar tabuleiro visual
function createBoard() {
    const boardElement = document.getElementById('board');
    boardElement.innerHTML = '';
    
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = i;
        cell.addEventListener('click', () => handleCellClick(i));
        boardElement.appendChild(cell);
    }
}

// Atualizar tabuleiro com dados do banco
function updateBoard(boardArray) {
    const cells = document.querySelectorAll('.cell');
    
    cells.forEach((cell, index) => {
        const value = boardArray[index] || '';
        cell.textContent = value;
        cell.className = 'cell';
        
        if (value === 'X') {
            cell.classList.add('x');
        } else if (value === 'O') {
            cell.classList.add('o');
        }
    });
}

// Lidar com clique em uma célula
async function handleCellClick(index) {
    if (!roomId || !playerSymbol || !isMyTurn) {
        console.log('Não é sua vez ou jogo não está ativo');
        return;
    }
    
    try {
        // Buscar estado atual do jogo
        const { data: room, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', roomId)
            .single();
        
        if (error || !room) {
            console.error('Erro ao buscar estado do jogo:', error);
            return;
        }
        
        // Verificar se é a vez deste jogador
        if (room.current_player !== playerSymbol) {
            console.log('Não é sua vez!');
            return;
        }
        
        // Converter string do banco para array
        const boardArray = room.board.split(',');
        
        // Verificar se célula está vazia
        if (boardArray[index] !== '') {
            console.log('Célula já ocupada!');
            return;
        }
        
        // Fazer jogada
        boardArray[index] = playerSymbol;
        const newBoard = boardArray.join(',');
        
        // Determinar próximo jogador
        const nextPlayer = playerSymbol === 'X' ? 'O' : 'X';
        
        // Atualizar no banco de dados
        const { error: updateError } = await supabase
            .from('rooms')
            .update({
                board: newBoard,
                current_player: nextPlayer,
                updated_at: new Date().toISOString()
            })
            .eq('id', roomId);
        
        if (updateError) {
            console.error('Erro ao atualizar tabuleiro:', updateError);
            return;
        }
        
        // Verificar se há vencedor
        const winner = checkWinner(boardArray);
        if (winner) {
            await endGame(winner, boardArray);
        } else if (boardArray.every(cell => cell !== '')) {
            // Empate
            await endGame('draw', boardArray);
        }
        
    } catch (error) {
        console.error('Erro ao processar jogada:', error);
    }
}

// Verificar se há vencedor
function checkWinner(boardArray) {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Linhas
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Colunas
        [0, 4, 8], [2, 4, 6]             // Diagonais
    ];
    
    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (boardArray[a] && 
            boardArray[a] === boardArray[b] && 
            boardArray[a] === boardArray[c]) {
            return boardArray[a]; // Retorna 'X' ou 'O'
        }
    }
    
    return null; // Sem vencedor
}

// Finalizar jogo
async function endGame(winner, boardArray) {
    try {
        const status = winner === 'draw' ? 'finished_draw' : 'finished_win';
        const winnerName = winner === 'draw' ? null : 
                          (winner === 'X' ? 'player1' : 'player2');
        
        // Atualizar status da sala
        const { error } = await supabase
            .from('rooms')
            .update({
                status: status,
                winner: winnerName,
                updated_at: new Date().toISOString()
            })
            .eq('id', roomId);
        
        if (error) {
            console.error('Erro ao finalizar jogo:', error);
            return;
        }
        
        // Mostrar mensagem de resultado
        if (winner === 'draw') {
            addSystemMessage('🤝 Jogo empatado!');
            document.getElementById('status-text').innerHTML = 
                '🤝 <strong>EMPATE!</strong><br>Ninguém venceu!';
        } else if (winner === playerSymbol) {
            addSystemMessage(`🎉 ${playerName} venceu o jogo!`);
            document.getElementById('status-text').innerHTML = 
                '🎉 <strong>VOCÊ VENCEU!</strong><br>Parabéns!';
        } else {
            addSystemMessage(`😢 ${playerName} perdeu o jogo!`);
            document.getElementById('status-text').innerHTML = 
                '😢 <strong>VOCÊ PERDEU!</strong><br>Tente novamente!';
        }
        
        // Mostrar botão de reinício
        document.getElementById('restart-btn').style.display = 'inline-block';
        
        // Desabilitar tabuleiro
        isMyTurn = false;
        
    } catch (error) {
        console.error('Erro ao finalizar jogo:', error);
    }
}

// Reiniciar jogo
async function restartGame() {
    if (!roomId) return;
    
    try {
        // Resetar jogo no banco de dados
        const { error } = await supabase
            .from('rooms')
            .update({
                board: ',,,,,,,,',
                current_player: 'X',
                status: 'playing',
                winner: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', roomId);
        
        if (error) {
            console.error('Erro ao reiniciar jogo:', error);
            return;
        }
        
        // Resetar interface
        updateBoard(['', '', '', '', '', '', '', '', '']);
        document.getElementById('restart-btn').style.display = 'none';
        
        // Determinar de quem é a vez
        isMyTurn = (playerSymbol === 'X');
        
        if (isMyTurn) {
            document.getElementById('status-text').innerHTML = 
                '✅ <strong>SUA VEZ!</strong><br>Você é o Jogador X';
        } else {
            document.getElementById('status-text').innerHTML = 
                '⏳ <strong>Aguardando jogada...</strong><br>Você é o Jogador O';
        }
        
        addSystemMessage('Jogo reiniciado!');
        
    } catch (error) {
        console.error('Erro ao reiniciar jogo:', error);
    }
}

// =============================================
// FUNÇÕES DE CHAT
// =============================================

// Enviar mensagem
async function sendMessage() {
    if (!roomId || !playerName) return;
    
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    try {
        // Inserir mensagem no banco de dados
        const { error } = await supabase
            .from('messages')
            .insert([{
                room_id: roomId,
                player_name: playerName,
                message: message,
                created_at: new Date().toISOString()
            }]);
        
        if (error) {
            console.error('Erro ao enviar mensagem:', error);
            return;
        }
        
        // Limpar input
        input.value = '';
        
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
    }
}

// =============================================
// FUNÇÕES AUXILIARES
// =============================================

// Lidar com atualização da sala
function handleRoomUpdate(payload) {
    console.log('Atualização da sala recebida:', payload);
    
    const newData = payload.new;
    
    // Atualizar nomes dos jogadores
    updatePlayerNames(newData.player1, newData.player2);
    
    // Atualizar tabuleiro se houver mudança
    if (newData.board) {
        const boardArray = newData.board.split(',');
        updateBoard(boardArray);
        
        // Atualizar de quem é a vez
        isMyTurn = (playerSymbol === newData.current_player);
        
        if (isMyTurn) {
            document.getElementById('status-text').innerHTML = 
                '✅ <strong>SUA VEZ!</strong><br>Faça sua jogada!';
        } else {
            document.getElementById('status-text').innerHTML = 
                '⏳ <strong>Aguardando jogada...</strong><br>Vez do oponente';
        }
    }
    
    // Se a sala acabou de ser criada
    if (payload.eventType === 'INSERT') {
        addSystemMessage(`Sala ${newData.id} criada por ${newData.player1}`);
    }
    
    // Se um jogador entrou
    if (payload.eventType === 'UPDATE' && newData.player2 && !payload.old.player2) {
        addSystemMessage(`${newData.player2} entrou na sala!`);
        
        if (playerSymbol === 'X') {
            document.getElementById('status-text').innerHTML = 
                '🎉 <strong>Oponente conectado!</strong><br>Sua vez (Jogador X)';
        }
    }
    
    // Se o jogo terminou
    if (newData.status && newData.status.startsWith('finished')) {
        document.getElementById('restart-btn').style.display = 'inline-block';
        isMyTurn = false;
    }
}

// Lidar com nova mensagem no chat
function handleNewMessage(payload) {
    const message = payload.new;
    
    // Não mostrar mensagens do próprio jogador (já mostramos localmente)
    if (message.player_name === playerName) return;
    
    // Adicionar mensagem no chat
    const isOwn = message.player_name === playerName;
    addMessage(message.player_name, message.message, isOwn);
}

// Atualizar nomes dos jogadores na interface
function updatePlayerNames(player1Name = null, player2Name = null) {
    if (player1Name) {
        const displayName1 = player1Name + (playerSymbol === 'X' ? ' (Você)' : '');
        document.getElementById('player-x-name').textContent = displayName1;
    }
    
    if (player2Name) {
        const displayName2 = player2Name + (playerSymbol === 'O' ? ' (Você)' : '');
        document.getElementById('player-o-name').textContent = displayName2;
    } else if (playerSymbol === 'O') {
        document.getElementById('player-o-name').textContent = playerName + ' (Você)';
    }
}

// Adicionar mensagem no chat
function addMessage(sender, message, isOwn) {
    const messagesElement = document.getElementById('messages');
    const messageElement = document.createElement('div');
    
    messageElement.classList.add('message');
    messageElement.classList.add(isOwn ? 'own' : 'other');
    messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
    
    messagesElement.appendChild(messageElement);
    messagesElement.scrollTop = messagesElement.scrollHeight;
}

// Adicionar mensagem do sistema
function addSystemMessage(message) {
    const messagesElement = document.getElementById('messages');
    const messageElement = document.createElement('div');
    
    messageElement.classList.add('message');
    messageElement.classList.add('other');
    messageElement.innerHTML = `<strong>⚡ Sistema:</strong> ${message}`;
    messageElement.style.fontStyle = 'italic';
    messageElement.style.opacity = '0.8';
    
    messagesElement.appendChild(messageElement);
    messagesElement.scrollTop = messagesElement.scrollHeight;
}

// Gerar código da sala (4 caracteres)
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removi 0,1,I,O para evitar confusão
    let code = '';
    
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return code;
}

// Calcular tempo desde uma data
function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'agora mesmo';
    if (diffMins < 60) return `há ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
}

// =============================================
// FUNÇÕES GLOBAIS (acessíveis pelo HTML)
// =============================================

// Tornar funções disponíveis globalmente
window.createRoom = createRoom;
window.listAvailableRooms = listAvailableRooms;
window.joinRoomByCode = joinRoomByCode;
window.sendMessage = sendMessage;
window.restartGame = restartGame;
window.handleCellClick = handleCellClick;

console.log('Jogo da Velha Online carregado!');