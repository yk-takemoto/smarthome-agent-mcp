# Build

## docker build and run at local

```sh
cd smarthome-agent
docker build -f infra/Dockerfile -t <docker registory endpoint>/smarthome-agent/standalone:latest .
docker run --rm -it -p 3000:3000/tcp --env-file=.env.local <docker registory endpoint>/smarthome-agent/standalone:latest
```
