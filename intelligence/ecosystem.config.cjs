module.exports = {
  apps: [{ name: "sol-intel-telegram", cwd: __dirname,
    script: "src/telegram.ts", interpreter: "node", node_args: "--import tsx",
    instances: 1, exec_mode: "fork", max_memory_restart: "512M" }]
};
