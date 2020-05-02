 # Detect OS
ifeq ($(OS),Windows_NT)
	DETECTED_OS := Windows
else
	DETECTED_OS := $(shell uname)
endif

COMPOSE_COMMAND := docker-compose

# Linux requires sudo to run docker-compose
ifeq ($(DETECTED_OS),Linux)
	COMPOSE_COMMAND := sudo docker-compose
endif

default:
	${COMPOSE_COMMAND} up
