/**
 * Tasks Service Tests
 * 
 * Tests for task CRUD operations, filtering, sorting, and ownership verification.
 */

import mongoose from 'mongoose';
import {
    getUserTasks,
    getTaskById,
    createTask,
    createBulkTasks,
    updateTask,
    deleteTask,
    getTaskStats,
} from '../services/tasks.service.js';
import Task from '../../../models/taskModel.js';
import { createTestUser } from '../../../test/utils.js';

describe('Tasks Service', () => {
    let testUser;
    let otherUser;

    beforeEach(async () => {
        // Create test users
        testUser = await createTestUser({
            name: 'Task User',
            email: 'taskuser@test.com',
            password: 'Password123!',
            roles: ['user'],
        });

        otherUser = await createTestUser({
            name: 'Other User',
            email: 'otheruser@test.com',
            password: 'Password123!',
            roles: ['user'],
        });
    });

    // =========================================================================
    // createTask Tests
    // =========================================================================
    describe('createTask', () => {
        it('should create a new task with required fields', async () => {
            const taskData = {
                title: 'Test Task',
                description: 'Test description',
            };

            const task = await createTask(testUser._id, taskData);

            expect(task).toBeDefined();
            expect(task.title).toBe('Test Task');
            expect(task.description).toBe('Test description');
            expect(task.user.toString()).toBe(testUser._id.toString());
            expect(task.status).toBe('To Do'); // Default status
        });

        it('should create a task with all optional fields', async () => {
            const dueDate = new Date('2025-12-31');
            const taskData = {
                title: 'Complete Task',
                description: 'Full description',
                dueDate,
                priority: 'High',
                status: 'In Progress',
                tags: ['work', 'urgent'],
            };

            const task = await createTask(testUser._id, taskData);

            expect(task.title).toBe('Complete Task');
            expect(task.priority).toBe('High');
            expect(task.status).toBe('In Progress');
            expect(task.tags).toEqual(['work', 'urgent']);
            expect(new Date(task.dueDate).toDateString()).toBe(dueDate.toDateString());
        });

        it('should throw error if title is missing', async () => {
            const taskData = {
                description: 'No title task',
            };

            await expect(createTask(testUser._id, taskData))
                .rejects.toThrow('Title is required for the task');
        });
    });

    // =========================================================================
    // getUserTasks Tests
    // =========================================================================
    describe('getUserTasks', () => {
        beforeEach(async () => {
            // Create multiple tasks for testing with explicit timestamps
            const now = new Date();
            await Task.create([
                { user: testUser._id, title: 'Task 1', priority: 'High', status: 'To Do', createdAt: new Date(now.getTime() - 3000) },
                { user: testUser._id, title: 'Task 2', priority: 'Medium', status: 'In Progress', createdAt: new Date(now.getTime() - 2000) },
                { user: testUser._id, title: 'Task 3', priority: 'Low', status: 'Done', createdAt: new Date(now.getTime() - 1000) },
                { user: otherUser._id, title: 'Other Task', priority: 'High', status: 'To Do' },
            ]);
        });

        it('should return only tasks belonging to the user', async () => {
            const tasks = await getUserTasks(testUser._id);

            expect(tasks).toHaveLength(3);
            tasks.forEach(task => {
                expect(task.user.toString()).toBe(testUser._id.toString());
            });
        });

        it('should filter tasks by status', async () => {
            const tasks = await getUserTasks(testUser._id, { status: 'To Do' });

            expect(tasks).toHaveLength(1);
            expect(tasks[0].title).toBe('Task 1');
        });

        it('should filter tasks by priority', async () => {
            const tasks = await getUserTasks(testUser._id, { priority: 'High' });

            expect(tasks).toHaveLength(1);
            expect(tasks[0].title).toBe('Task 1');
        });

        it('should sort tasks by createdAt descending by default', async () => {
            const tasks = await getUserTasks(testUser._id);

            // Most recently created should be first
            expect(tasks[0].title).toBe('Task 3');
        });

        it('should sort tasks by specified field and order', async () => {
            const tasks = await getUserTasks(testUser._id, { sortBy: 'title:asc' });

            expect(tasks[0].title).toBe('Task 1');
            expect(tasks[1].title).toBe('Task 2');
            expect(tasks[2].title).toBe('Task 3');
        });

        it('should return empty array for user with no tasks', async () => {
            const newUser = await createTestUser({
                name: 'New User',
                email: 'newuser@test.com',
                password: 'Password123!',
                roles: ['user'],
            });

            const tasks = await getUserTasks(newUser._id);

            expect(tasks).toHaveLength(0);
        });
    });

    // =========================================================================
    // getTaskById Tests
    // =========================================================================
    describe('getTaskById', () => {
        let testTask;

        beforeEach(async () => {
            testTask = await Task.create({
                user: testUser._id,
                title: 'Specific Task',
                description: 'Task to retrieve',
            });
        });

        it('should return task by ID for owner', async () => {
            const task = await getTaskById(testTask._id, testUser._id.toString());

            expect(task).toBeDefined();
            expect(task.title).toBe('Specific Task');
        });

        it('should throw error for non-existent task', async () => {
            const fakeId = new mongoose.Types.ObjectId();

            await expect(getTaskById(fakeId, testUser._id.toString()))
                .rejects.toThrow('Task not found');
        });

        it('should throw 403 error when non-owner tries to access', async () => {
            try {
                await getTaskById(testTask._id, otherUser._id.toString());
                fail('Expected error to be thrown');
            } catch (error) {
                expect(error.message).toBe('User not authorized to access this task');
                expect(error.statusCode).toBe(403);
            }
        });
    });

    // =========================================================================
    // createBulkTasks Tests
    // =========================================================================
    describe('createBulkTasks', () => {
        it('should create multiple tasks at once', async () => {
            const tasksData = [
                { title: 'Bulk Task 1', priority: 'High' },
                { title: 'Bulk Task 2', priority: 'Medium' },
                { title: 'Bulk Task 3', priority: 'Low' },
            ];

            const tasks = await createBulkTasks(testUser._id, tasksData);

            expect(tasks).toHaveLength(3);
            tasks.forEach((task, index) => {
                expect(task.title).toBe(`Bulk Task ${index + 1}`);
                expect(task.user.toString()).toBe(testUser._id.toString());
                expect(task.status).toBe('To Do'); // Default status
            });
        });

        it('should throw error for empty array', async () => {
            await expect(createBulkTasks(testUser._id, []))
                .rejects.toThrow('Please provide a valid array of tasks');
        });

        it('should throw error for null tasks', async () => {
            await expect(createBulkTasks(testUser._id, null))
                .rejects.toThrow('Please provide a valid array of tasks');
        });

        it('should throw error when exceeding max tasks limit', async () => {
            const tooManyTasks = Array(16).fill({ title: 'Task' });

            await expect(createBulkTasks(testUser._id, tooManyTasks))
                .rejects.toThrow('Cannot create more than 15 tasks at once');
        });

        it('should preserve task status when provided', async () => {
            const tasksData = [
                { title: 'Task 1', status: 'In Progress' },
                { title: 'Task 2' }, // No status - should default
            ];

            const tasks = await createBulkTasks(testUser._id, tasksData);

            expect(tasks[0].status).toBe('In Progress');
            expect(tasks[1].status).toBe('To Do');
        });
    });

    // =========================================================================
    // updateTask Tests
    // =========================================================================
    describe('updateTask', () => {
        let testTask;

        beforeEach(async () => {
            testTask = await Task.create({
                user: testUser._id,
                title: 'Original Title',
                description: 'Original description',
                status: 'To Do',
                priority: 'Medium',
            });
        });

        it('should update task fields', async () => {
            const updatedTask = await updateTask(
                testTask._id,
                testUser._id.toString(),
                { title: 'Updated Title', status: 'In Progress' }
            );

            expect(updatedTask.title).toBe('Updated Title');
            expect(updatedTask.status).toBe('In Progress');
            expect(updatedTask.description).toBe('Original description'); // Unchanged
        });

        it('should throw 404 for non-existent task', async () => {
            const fakeId = new mongoose.Types.ObjectId();

            try {
                await updateTask(fakeId, testUser._id.toString(), { title: 'New' });
                fail('Expected error to be thrown');
            } catch (error) {
                expect(error.message).toBe('Task not found');
                expect(error.statusCode).toBe(404);
            }
        });

        it('should throw 403 when non-owner tries to update', async () => {
            try {
                await updateTask(testTask._id, otherUser._id.toString(), { title: 'Hacked' });
                fail('Expected error to be thrown');
            } catch (error) {
                expect(error.message).toBe('User not authorized to update this task');
                expect(error.statusCode).toBe(403);
            }
        });
    });

    // =========================================================================
    // deleteTask Tests
    // =========================================================================
    describe('deleteTask', () => {
        let testTask;

        beforeEach(async () => {
            testTask = await Task.create({
                user: testUser._id,
                title: 'Task to Delete',
            });
        });

        it('should delete task and return its ID', async () => {
            const result = await deleteTask(testTask._id, testUser._id.toString());

            expect(result.id.toString()).toBe(testTask._id.toString());

            // Verify task is actually deleted
            const deletedTask = await Task.findById(testTask._id);
            expect(deletedTask).toBeNull();
        });

        it('should throw 404 for non-existent task', async () => {
            const fakeId = new mongoose.Types.ObjectId();

            try {
                await deleteTask(fakeId, testUser._id.toString());
                fail('Expected error to be thrown');
            } catch (error) {
                expect(error.message).toBe('Task not found');
                expect(error.statusCode).toBe(404);
            }
        });

        it('should throw 403 when non-owner tries to delete', async () => {
            try {
                await deleteTask(testTask._id, otherUser._id.toString());
                fail('Expected error to be thrown');
            } catch (error) {
                expect(error.message).toBe('User not authorized to delete this task');
                expect(error.statusCode).toBe(403);
            }
        });
    });

    // =========================================================================
    // getTaskStats Tests
    // =========================================================================
    describe('getTaskStats', () => {
        beforeEach(async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            await Task.create([
                { user: testUser._id, title: 'Task 1', status: 'To Do', priority: 'High' },
                { user: testUser._id, title: 'Task 2', status: 'To Do', priority: 'Medium' },
                { user: testUser._id, title: 'Task 3', status: 'In Progress', priority: 'High' },
                { user: testUser._id, title: 'Task 4', status: 'Done', priority: 'Low' },
                { 
                    user: testUser._id, 
                    title: 'Overdue Task', 
                    status: 'In Progress', 
                    priority: 'High',
                    dueDate: yesterday,
                },
            ]);
        });

        it('should return correct stats by status', async () => {
            const stats = await getTaskStats(testUser._id);

            expect(stats.total).toBe(5);

            const todoCount = stats.byStatus.find(s => s._id === 'To Do')?.count || 0;
            const inProgressCount = stats.byStatus.find(s => s._id === 'In Progress')?.count || 0;
            const doneCount = stats.byStatus.find(s => s._id === 'Done')?.count || 0;

            expect(todoCount).toBe(2);
            expect(inProgressCount).toBe(2);
            expect(doneCount).toBe(1);
        });

        it('should return correct stats by priority', async () => {
            const stats = await getTaskStats(testUser._id);

            const highCount = stats.byPriority.find(p => p._id === 'High')?.count || 0;
            const mediumCount = stats.byPriority.find(p => p._id === 'Medium')?.count || 0;
            const lowCount = stats.byPriority.find(p => p._id === 'Low')?.count || 0;

            expect(highCount).toBe(3);
            expect(mediumCount).toBe(1);
            expect(lowCount).toBe(1);
        });

        it('should count overdue tasks correctly', async () => {
            const stats = await getTaskStats(testUser._id);

            expect(stats.overdue).toBe(1);
        });

        it('should return zeros for user with no tasks', async () => {
            const newUser = await createTestUser({
                name: 'Empty User',
                email: 'empty@test.com',
                password: 'Password123!',
                roles: ['user'],
            });

            const stats = await getTaskStats(newUser._id);

            expect(stats.total).toBe(0);
            expect(stats.overdue).toBe(0);
            expect(stats.byStatus).toHaveLength(0);
            expect(stats.byPriority).toHaveLength(0);
        });
    });
});
