module.exports = {
  apps: [
    {
      name: "possum-public-site",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3002 -H 127.0.0.1",
      watch: false,
      instances: 1,
      exec_mode: "fork",
      node_args: "--max-old-space-size=320 --max-semi-space-size=16",
      max_memory_restart: "380M",
      restart_delay: 3000,
      exp_backoff_restart_delay: 400,
      kill_timeout: 15000,
      min_uptime: "20s",
      listen_timeout: 10000,
      env: {
        NODE_ENV: "production",
        PORT: "3002",
        HOSTNAME: "127.0.0.1",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
};
