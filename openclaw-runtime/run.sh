#!/bin/bash
cd ~/.openclaw/workspace/openclaw-runtime
/usr/local/bin/node dist/server.js > /tmp/server-startup.log 2>&1
echo "Server started, PID: $!"
