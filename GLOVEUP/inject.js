const fs = require('fs');

const lines = fs.readFileSync('dashboard/entrenador/dashboard.html', 'utf8').split('\n');
const notifChatHtml = lines.slice(106, 171).join('\n'); // 107-171 in 1-based index is 106-171 in 0-based slice (wait, 107 in 1-based is index 106, 171 is index 170. slice(106, 171) returns 106 to 170 inclusive). Let's check. 

const filesToUpdate = ['sparring/index.html', 'gyms/index.html', 'profile/index.html'];
for (const file of filesToUpdate) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Insert CSS
    if (!content.includes('notifications.css')) {
        content = content.replace(/<\/head>/i, '    <link rel="stylesheet" href="../home/notifications.css">\n</head>');
    }
    
    // Insert HTML (before </main> or <body> end)
    if (!content.includes('glv-notif-container')) {
        content = content.replace(/<\/body>/i, notifChatHtml + '\n</body>');
    }
    
    // Insert JS
    if (!content.includes('chat.js')) {
        content = content.replace(/<\/body>/i, '    <script src="../home/chat.js"></script>\n    <script src="../home/notifications.js"></script>\n</body>');
    }
    
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
}
