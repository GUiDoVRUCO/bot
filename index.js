const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const { JsonDB } = require('node-json-db');
const { Config } = require('node-json-db/dist/lib/JsonDBConfig');
const app = express();
const db = new JsonDB(new Config('clients', true, true, '/'));

// Middleware para JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inicializar cliente WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true, args: ['--no-sandbox'] }
});

// Mostrar QR code no terminal
client.on('qr', (qr) => {
  console.log('Escaneie o QR code abaixo com o WhatsApp:');
  qrcode.generate(qr, { small: true });
});

// Quando o cliente estiver pronto
client.on('ready', () => {
  console.log('Bot está pronto!');
});

// Salvar cliente no banco de dados
async function saveClient(phone, name) {
  try {
    await db.push(`/clients/${phone}`, { phone, name, allowed: true }, true);
  } catch (error) {
    console.error('Erro ao salvar cliente:', error);
  }
}

// Verificar se cliente está autorizado
async function isClientAllowed(phone) {
  try {
    const clientData = await db.getData(`/clients/${phone}`);
    return clientData.allowed;
  } catch (error) {
    return false;
  }
}

// Lógica do bot
client.on('message', async (message) => {
  const phone = message.from.split('@')[0];
  let name = message.notifyName || 'Cliente';

  // Salvar novo cliente
  await saveClient(phone, name);

  // Verificar se cliente está autorizado
  if (!(await isClientAllowed(phone))) {
    message.reply('🚫 Você não tem permissão para usar este bot. Contate o administrador.');
    return;
  }

  const msg = message.body.toLowerCase();

  if (msg === '/menu') {
    message.reply(
      `Bem-vindo à Barbearia! 😎\n` +
      `Comandos disponíveis:\n` +
      `/agendar - Agendar um horário\n` +
      `/horarios - Ver horários disponíveis\n` +
      `/cancelar - Cancelar um agendamento`
    );
  } else if (msg === '/agendar') {
    message.reply('📅 Envie o horário desejado (ex: 14:00). Horários disponíveis: 9:00, 10:00, 11:00, 14:00, 15:00.');
  } else if (msg === '/horarios') {
    message.reply('🕒 Horários disponíveis: 9:00, 10:00, 11:00, 14:00, 15:00.');
  } else if (msg === '/cancelar') {
    message.reply('🗑️ Agendamento cancelado (funcionalidade de exemplo).');
  } else if (msg.startsWith('/agendar ')) {
    const time = msg.split(' ')[1];
    const validTimes = ['9:00', '10:00', '11:00', '14:00', '15:00'];
    if (validTimes.includes(time)) {
      message.reply(`✅ Agendamento confirmado para ${time}!`);
    } else {
      message.reply('❌ Horário inválido. Use: 9:00, 10:00, 11:00, 14:00, 15:00.');
    }
  } else {
    message.reply('🤔 Comando inválido. Digite /menu para ver os comandos.');
  }
});

// Iniciar cliente WhatsApp
client.initialize();

// Painel Web
app.get('/', async (req, res) => {
  try {
    const clients = await db.getData('/clients');
    let html = '<h1>Painel de Clientes - Barbearia</h1><table border="1"><tr><th>Telefone</th><th>Nome</th><th>Permitido</th><th>Ação</th></tr>';
    for (const [phone, data] of Object.entries(clients)) {
      html += `<tr><td>${phone}</td><td>${data.name}</td><td>${data.allowed ? 'Sim' : 'Não'}</td>` +
              `<td><form action="/toggle/${phone}" method="POST">` +
              `<button type="submit">${data.allowed ? 'Bloquear' : 'Permitir'}</button></form></td></tr>`;
    }
    html += '</table>';
    res.send(html);
  } catch (error) {
    res.send('Erro ao carregar painel.');
  }
});

// Alternar permissão de cliente
app.post('/toggle/:phone', async (req, res) => {
  const phone = req.params.phone;
  try {
    const clientData = await db.getData(`/clients/${phone}`);
    await db.push(`/clients/${phone}/allowed`, !clientData.allowed);
    res.redirect('/');
  } catch (error) {
    res.send('Erro ao atualizar permissão.');
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});