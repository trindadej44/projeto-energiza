const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const session = require('express-session');
require('dotenv').config(); // Para carregar variáveis de ambiente do .env

// Inicialização do Express
const app = express();
app.use(express.json());

// Configuração de sessões
app.use(session({
  secret: process.env.SESSION_SECRET || 'secreta', // Chave secreta para criptografar a sessão
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Definir como true se estiver usando HTTPS
}));

// Serve arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Serve imagens da pasta 'imgs' caso sejam requisitadas diretamente
app.use('/imgs', express.static(path.join(__dirname, 'imgs')));

// Conexão com o banco de dados PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'autorack.proxy.rlwy.net',
  database: 'railway',
  password: 'bwCWczHxLhLaKqCYeSztQIbEnToxBOwP',
  port: 13264,
});

// Rota para cadastro de usuário (registro)
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Verifica se o nome de usuário já existe
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      return res.status(400).json({ message: 'Nome de usuário já existe' });
    }

    // Gera o hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insere o novo usuário no banco de dados com o hash da senha
    await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);

    res.status(201).json({ message: 'Usuário registrado com sucesso!' });
  } catch (err) {
    console.error('Erro ao registrar usuário:', err);
    res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Rota de Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Verifica se o usuário existe no banco de dados
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Usuário não encontrado' });
    }

    const user = result.rows[0];

    // Compara a senha fornecida com o hash armazenado
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Senha incorreta' });
    }

    // Cria a sessão para o usuário após login bem-sucedido
    req.session.userId = user.id;
    req.session.username = user.username;

    // Retorna uma resposta de sucesso
    res.json({ message: 'Login bem-sucedido' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Rota para logout, destruindo a sessão
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Erro ao tentar sair' });
    }
    res.json({ message: 'Logout bem-sucedido' });
  });
});

// Rota para verificar se o usuário está autenticado
app.get('/profile', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Usuário não autenticado' });
  }

  // Se o usuário estiver autenticado, retorna os dados do perfil
  res.json({ message: 'Perfil de usuário', user: { id: req.session.userId, username: req.session.username } });
});

// Rota para servir o arquivo 'index.html'
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

//app.use((req, res) => {
  //res.status(404).sendFile(path.join(__dirname, 'public', 'error-page.html'));
//});

// Iniciar o servidor
app.listen(3004, () => {
  console.log('Servidor rodando em http://localhost:3004');
});

function isAuthenticated(req, res, next) {
  if (!req.session.user) {
      return res.sendStatus(401); // Não autorizado
  }
  next();
}

app.get('/api/devices', async (req, res) => {
    const userId = req.session.userId; // Obter o ID do usuário autenticado

    if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    try {
        const result = await pool.query('SELECT * FROM devices WHERE user_id = $1', [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar dispositivos:', err);
        res.status(500).json({ error: err.message });
    }
});


app.post('/api/devices', async (req, res) => {
  const { name, consumption, status } = req.body;
  const userId = req.session.userId; // Obtém o ID do usuário da sessão

  if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  try {
      const result = await pool.query(
          'INSERT INTO devices (name, consumption, status, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
          [name, consumption, status, userId]
      );
      res.status(201).json(result.rows[0]);
  } catch (err) {
      console.error('Erro no servidor:', err);
      res.status(500).json({ error: err.message });
  }
});

// Delete a device
app.delete('/api/devices/:id', async (req, res) => {
  const deviceId = req.params.id;
  const userId = req.session.userId; // ID do usuário autenticado

  if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  try {
      const result = await pool.query(
          'DELETE FROM devices WHERE id = $1 AND user_id = $2 RETURNING *',
          [deviceId, userId]
      );

      if (result.rowCount === 0) {
          return res.status(404).json({ error: 'Dispositivo não encontrado' });
      }

      res.status(204).send(); // Retorna 204 sem corpo em caso de sucesso
  } catch (err) {
      console.error('Erro ao excluir dispositivo:', err);
      res.status(500).json({ error: err.message });
  }
});