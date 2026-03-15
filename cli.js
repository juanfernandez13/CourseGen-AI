#!/usr/bin/env node
// Modo CLI: processa matriz.docx + quizzes/ + tarefas/ sem iniciar servidor web
process.env.CLI_MODE = '1';
require('./server.js');
