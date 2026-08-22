# Microfinance Loan Management System

This repository contains a starter full-stack web application for a microfinance loan management system.

## Stack
- Frontend: React (JavaScript) with Vite
- Backend: Node.js + Express
- Database: PostgreSQL with Prisma ORM

## Setup
1. Install dependencies for backend and frontend:
   - `cd backend && npm install`
   - `cd ../frontend && npm install`
2. Configure the backend database connection in `backend/.env`.
3. Initialize the database:
   - `cd backend && npx prisma migrate dev --name init`
   - `cd backend && npx prisma db seed`
4. Start the backend and frontend:
   - `cd backend && npm run dev`
   - `cd ../frontend && npm run dev`

## Demo Users
- admin / Password123!
- director / Password123!
- branchmanager / Password123!
- creditofficer / Password123!
- cashier / Password123!
- auditor / Password123!

## Notes
- The backend exposes REST APIs under `/api`.
- The frontend is configured to connect to the backend at `http://localhost:4000`.
- This scaffold includes authentication, customer management, loan products, and loan application endpoints.
