# EnterpriseIQ AI Instructions

## Purpose

This document defines the engineering rules that every AI assistant (Antigravity, ChatGPT, or future coding assistants) must follow when contributing to EnterpriseIQ.

The architecture documents inside `/docs` are the single source of truth. Any implementation must comply with them.

---

# Project Mission

EnterpriseIQ is an Enterprise AI Knowledge Intelligence Platform that centralizes organizational knowledge and enables employees to securely search, understand, and interact with enterprise information using conversational AI.

The objective is to build production-quality software, not prototype code.

---

# Approved Technology Stack

## Frontend

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

## Backend

- NestJS
- TypeScript
- REST API
- Modular Monolith

## Database

- PostgreSQL
- Prisma ORM
- pgvector

## AI

- Google Gemini
- LangChain
- AI Provider Abstraction

## Authentication

- JWT
- Refresh Tokens
- RBAC

## Storage

- Local Storage
- Storage Abstraction

## Deployment

- Docker Compose

---

# Architecture Rules

Always follow the approved documents inside `/docs`.

Never introduce new architecture without approval.

Never change technology choices without approval.

Never bypass abstraction layers.

Never create circular dependencies.

Always respect Clean Architecture.

---

# Coding Standards

- Use TypeScript strict mode.
- Keep functions small and focused.
- Prefer composition over inheritance.
- Use dependency injection.
- Avoid duplicate logic.
- Follow SOLID principles.
- Write readable code before clever code.

---

# Naming Conventions

Classes:
- PascalCase

Interfaces:
- Prefix with I

Services:
- *Service

Controllers:
- *Controller

DTOs:
- *Dto

Enums:
- PascalCase

Variables:
- camelCase

Constants:
- UPPER_SNAKE_CASE

---

# Security Rules

Always validate input.

Never trust client input.

Always use DTO validation.

Never expose secrets.

Never hardcode credentials.

Always enforce RBAC.

Always sanitize uploaded files.

Always implement proper error handling.

---

# Database Rules

Use Prisma only.

Never write raw SQL unless absolutely necessary.

Use migrations.

Keep schema synchronized with documentation.

---

# AI Rules

Business logic must never depend directly on Gemini.

Always use the AI Provider abstraction.

LangChain is an orchestration library only.

Keep prompts modular.

Always return citations.

---

# Documentation Rules

Every significant feature must update:

- CHANGELOG.md
- Relevant document inside `/docs`

---

# Things You Must Never Do

- Never rewrite project architecture.
- Never replace approved technologies.
- Never introduce unnecessary dependencies.
- Never generate placeholder code marked "TODO" unless requested.
- Never silently change APIs.
- Never ignore engineering standards.
- Never modify documentation without keeping it synchronized.

---

# Definition of Done

A feature is complete only when:

- Code compiles.
- Lint passes.
- Tests pass.
- Documentation updated.
- No critical warnings.
- Docker build succeeds.
- Feature matches architecture documents.