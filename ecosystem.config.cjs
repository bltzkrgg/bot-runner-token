module.exports = {
  apps: [{ name: "gmgn-unified-bot", cwd: __dirname, script: "src/index.js",
    interpreter: "node", node_args: "--import tsx", instances: 1, exec_mode: "fork",
    max_memory_restart: "512M" }]
};
