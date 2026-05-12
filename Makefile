# Makefile for SPA Runtime++ Automation

.PHONY: build run stop reset snapshot restore logs

build:
	docker build -t my-spa-app .

run:
	docker run --name my-spa-app -d -p 8081:80 my-spa-app

stop:
	docker stop my-spa-app || true
	docker rm my-spa-app || true

reset: stop build run

snapshot:
	docker commit my-spa-app my-spa-app:snapshot

restore: stop
	docker run --name my-spa-app -d -p 8081:80 my-spa-app:snapshot

logs:
	docker logs -f my-spa-app
