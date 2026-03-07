"use strict";
'use server';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsers = getUsers;
exports.saveUsers = saveUsers;
exports.getUserByEmail = getUserByEmail;
exports.getUserById = getUserById;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.deleteUser = deleteUser;
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.join(process.cwd(), 'data');
const USERS_FILE = path_1.default.join(DATA_DIR, 'users.json');
// Ensure data directory exists
async function ensureDataDir() {
    if (!(0, fs_1.existsSync)(DATA_DIR)) {
        await (0, promises_1.mkdir)(DATA_DIR, { recursive: true });
    }
}
// Read users from file
async function getUsers() {
    await ensureDataDir();
    if (!(0, fs_1.existsSync)(USERS_FILE)) {
        return [];
    }
    try {
        const data = await (0, promises_1.readFile)(USERS_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        // Handle both array and object formats
        if (Array.isArray(parsed)) {
            return parsed;
        }
        return Object.values(parsed);
    }
    catch (error) {
        console.error('Error reading users file:', error);
        return [];
    }
}
// Write users to file
async function saveUsers(users) {
    await ensureDataDir();
    await (0, promises_1.writeFile)(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}
// Find user by email
async function getUserByEmail(email) {
    const users = await getUsers();
    return users.find(user => user.email.toLowerCase() === email.toLowerCase()) || null;
}
// Find user by ID
async function getUserById(id) {
    const users = await getUsers();
    return users.find(user => user.id === id) || null;
}
// Create new user
// NOTE: We intentionally do NOT type this as `Omit<User, ...>` because `User` includes an
// index signature (`[key: string]: any`) which makes `Omit<User, ...>` lose required fields
// under `strict` TypeScript, breaking the scripts build.
async function createUser(user) {
    const users = await getUsers();
    const now = new Date().toISOString();
    const newUser = {
        ...user,
        createdAt: now,
        updatedAt: now,
    };
    users.push(newUser);
    await saveUsers(users);
    return newUser;
}
// Update user
async function updateUser(id, updates) {
    const users = await getUsers();
    const index = users.findIndex(user => user.id === id);
    if (index === -1) {
        return null;
    }
    users[index] = {
        ...users[index],
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    await saveUsers(users);
    return users[index];
}
// Delete user
async function deleteUser(id) {
    const users = await getUsers();
    const initialLength = users.length;
    const filtered = users.filter(user => user.id !== id);
    if (filtered.length === initialLength) {
        return false; // User not found
    }
    await saveUsers(filtered);
    return true;
}
