PYTHON ?= python3
VENV ?= .venv
HOST ?= 127.0.0.1
PORT ?= 8765
VENV_PYTHON := $(VENV)/bin/python
INSTALL_STAMP := $(VENV)/.installed

.PHONY: help venv install up dev health

help:
	@printf '%s\n' 'make venv     Create the local Python virtual environment'
	@printf '%s\n' 'make install  Create the virtual environment and install dependencies'
	@printf '%s\n' 'make up       Start the hook logger in the virtual environment'
	@printf '%s\n' 'make dev      Start the logger with auto-reload in the virtual environment'
	@printf '%s\n' 'make health   Check the local health endpoint'

venv: $(VENV_PYTHON)

$(VENV_PYTHON):
	$(PYTHON) -m venv $(VENV)

$(INSTALL_STAMP): requirements.txt $(VENV_PYTHON)
	$(VENV_PYTHON) -m pip install -r requirements.txt
	touch $(INSTALL_STAMP)

install: $(INSTALL_STAMP)

up: install
	$(VENV_PYTHON) -m uvicorn app:app --host $(HOST) --port $(PORT)

dev: install
	$(VENV_PYTHON) -m uvicorn app:app --host $(HOST) --port $(PORT) --reload

health:
	curl --fail --silent --show-error http://$(HOST):$(PORT)/healthz
