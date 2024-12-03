const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const session = require('express-session');
require('dotenv').config(); // Para carregar variáveis de ambiente do .env
const { Parser } = require('json2csv');
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
  const userId = req.session.userId;

  if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  try {
      // Insere o dispositivo na tabela 'devices'
      const deviceResult = await pool.query(
          'INSERT INTO devices (name, consumption, status, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
          [name, consumption, status, userId]
      );

      const device = deviceResult.rows[0];

      // Insere um registro inicial na tabela 'device_consumption'
      await pool.query(
          'INSERT INTO device_consumption (user_id, device_id, date, consumption) VALUES ($1, $2, CURRENT_DATE, $3)',
          [userId, device.id, consumption]
      );

      res.status(201).json(device);
  } catch (err) {
      console.error('Erro ao adicionar dispositivo:', err);
      res.status(500).json({ error: err.message });
  }
});


// Delete a device
app.delete('/api/devices/:id', async (req, res) => {
  const deviceId = req.params.id;
  const userId = req.session.userId;

  if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  try {
      // Exclua os registros de consumo relacionados ao dispositivo
      await pool.query(
          'DELETE FROM device_consumption WHERE device_id = $1 AND user_id = $2',
          [deviceId, userId]
      );

      // Exclua o dispositivo da tabela 'devices'
      const result = await pool.query(
          'DELETE FROM devices WHERE id = $1 AND user_id = $2 RETURNING *',
          [deviceId, userId]
      );

      if (result.rowCount === 0) {
          return res.status(404).json({ error: 'Dispositivo não encontrado' });
      }

      res.status(204).send(); // Retorna sucesso sem conteúdo
  } catch (err) {
      console.error('Erro ao excluir dispositivo:', err);
      res.status(500).json({ error: err.message });
  }
});


// Rota para previsão de consumo
app.get('/api/consumption-forecast', async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  try {
      // Obtem todos os dados históricos de consumo do usuário
      const result = await pool.query(`
          SELECT SUM(consumption) AS total_consumption, COUNT(*) AS days_count
          FROM device_consumption
          WHERE user_id = $1
      `, [userId]);

      const { total_consumption, days_count } = result.rows[0];

      // Se não houver dados, retornar previsão como 0
      if (!total_consumption || !days_count) {
          return res.json({
              forecast: '0.00',
              recommendations: ['Adicione dispositivos para iniciar o monitoramento.'],
          });
      }

      // Calcula a média diária e projeta o consumo para 30 dias
      const avgDailyConsumption = parseFloat(total_consumption) / parseInt(days_count, 10);
      const forecast = (avgDailyConsumption * 30).toFixed(2); // Projeta para 30 dias

      res.json({
          forecast,
          recommendations: [
              'Reduza o tempo de uso de dispositivos de alto consumo.',
              'Desligue dispositivos quando não estiverem em uso.',
              'Substitua dispositivos antigos por modelos mais eficientes.',
          ],
      });
  } catch (err) {
      console.error('Erro ao calcular previsão de consumo:', err);
      res.status(500).json({ error: 'Erro ao calcular previsão de consumo.' });
  }
});

const ExcelJS = require('exceljs');

app.get('/api/export-devices', async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    try {
        // Consulta os dispositivos do usuário
        const result = await pool.query('SELECT name, consumption, status FROM devices WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Nenhum dispositivo encontrado.' });
        }

        // Cria um novo workbook (arquivo Excel)
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Dispositivos');

        // Adiciona título personalizado
        worksheet.mergeCells('A1:C1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'Relatório de Dispositivos';
        titleCell.font = { size: 16, bold: true };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

        // Configura o cabeçalho
        worksheet.columns = [
            { header: 'Nome', key: 'name', width: 30 },
            { header: 'Consumo (W)', key: 'consumption', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
        ];

        worksheet.getRow(2).font = { bold: true }; // Estiliza o cabeçalho
        worksheet.getRow(2).alignment = { horizontal: 'center' }; // Alinha texto

        // Adiciona os dados
        result.rows.forEach((device, index) => {
            const row = worksheet.addRow({
                name: device.name,
                consumption: device.consumption,
                status: device.status,
            });

            // Alterna a cor de fundo para criar um "zebra pattern"
            if (index % 2 === 0) {
                row.eachCell(cell => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'F4F4F4' }, // Cinza claro
                    };
                });
            }
        });

        // Adiciona bordas a todas as células
        worksheet.eachRow(row => {
            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
            });
        });

        // Envia o arquivo Excel para download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=dispositivos.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Erro ao exportar dispositivos:', err);
        res.status(500).json({ error: 'Erro no servidor ao exportar dispositivos.' });
    }
});

app.get('/api/alerts', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
  }

  try {
      const threshold = 1000; // Exemplo: limite de 1000W
      const result = await pool.query(`
          SELECT name, consumption FROM devices WHERE user_id = $1 AND consumption > $2
      `, [userId, threshold]);

      if (result.rows.length === 0) {
          return res.json({ alerts: ['Todos os dispositivos estão dentro dos limites de consumo.'] });
      }

      const alerts = result.rows.map(device => `${device.name} está consumindo ${device.consumption}W.`);
      res.json({ alerts });
  } catch (err) {
      console.error('Erro ao buscar alertas:', err);
      res.status(500).json({ error: 'Erro ao buscar alertas de consumo.' });
  }
});


function checkAuthentication(req, res, next) {
  if (!req.session.userId) return res.status(401).send({ message: 'Por favor, faça login primeiro.' });
  next();
}

app.get('/api/solar-panels', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  try {
      const result = await pool.query(`
          SELECT 
              id, panel_name, capacity_watts, 
              installation_date, total_energy_generated, 
              current_output, status, location 
          FROM solar_panels 
          WHERE user_id = $1
      `, [userId]);

      res.json(result.rows);
  } catch (err) {
      console.error('Erro ao buscar painéis solares:', err);
      res.status(500).json({ error: 'Erro ao buscar painéis solares' });
  }
});

app.post('/api/solar-panels', async (req, res) => {
  const { panel_name, capacity_watts, installation_date, location } = req.body;
  const userId = req.session.userId;

  if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  try {
      const result = await pool.query(`
          INSERT INTO solar_panels 
          (user_id, panel_name, capacity_watts, installation_date, location) 
          VALUES ($1, $2, $3, $4, $5) 
          RETURNING *
      `, [userId, panel_name, capacity_watts, installation_date, location]);

      res.status(201).json(result.rows[0]);
  } catch (err) {
      console.error('Erro ao adicionar painel solar:', err);
      res.status(500).json({ error: 'Erro ao adicionar painel solar' });
  }
});

app.get('/api/solar-panels/performance', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  try {
      const performanceResult = await pool.query(`
          SELECT 
              SUM(total_energy_generated) as total_generated,
              AVG(current_output) as average_output,
              COUNT(*) as total_panels
          FROM solar_panels
          WHERE user_id = $1
      `, [userId]);

      const monthlyResult = await pool.query(`
          SELECT 
              EXTRACT(MONTH FROM date) as month, 
              SUM(energy_generated) as monthly_generation 
          FROM solar_energy_logs 
          JOIN solar_panels ON solar_energy_logs.solar_panel_id = solar_panels.id
          WHERE user_id = $1
          GROUP BY month
          ORDER BY month
      `, [userId]);

      res.json({
          performance: performanceResult.rows[0],
          monthly_data: monthlyResult.rows
      });
  } catch (err) {
      console.error('Erro ao buscar desempenho dos painéis solares:', err);
      res.status(500).json({ error: 'Erro ao buscar desempenho' });
  }
});

// Add this to the existing server.js file
app.get('/api/energy-timeline', async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
  
    try {
      // Fetch daily energy consumption
      const dailyConsumption = await pool.query(`
        SELECT 
          date, 
          SUM(consumption) as total_consumption
        FROM device_consumption
        WHERE user_id = $1
        GROUP BY date
        ORDER BY date DESC
        LIMIT 30
      `, [userId]);
  
      // Fetch device-wise consumption
      const deviceConsumption = await pool.query(`
        SELECT 
          d.name, 
          SUM(dc.consumption) as total_consumption
        FROM devices d
        JOIN device_consumption dc ON d.id = dc.device_id
        WHERE d.user_id = $1
        GROUP BY d.name
      `, [userId]);
  
      res.json({
        daily_consumption: dailyConsumption.rows,
        device_breakdown: deviceConsumption.rows
      });
    } catch (err) {
      console.error('Erro ao buscar timeline de energia:', err);
      res.status(500).json({ error: 'Erro ao buscar dados de energia' });
    }
  });

app.use(['/api/devices', '/api/consumption-forecast'], checkAuthentication);

