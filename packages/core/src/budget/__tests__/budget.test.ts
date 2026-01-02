/**
 * Tests for budget management module
 */

import { describe, it, expect } from 'vitest';
import {
  createBudgetManager,
  MODEL_BUDGETS,
  getModelBudget,
} from '../index.js';
import type { ChatMessage } from '../../types/index.js';

describe('createBudgetManager', () => {
  it('should create a budget manager with defaults', () => {
    const manager = createBudgetManager({
      maxInputTokens: 4096,
      maxOutputTokens: 1024,
    });

    expect(manager.budget.maxInputTokens).toBe(4096);
    expect(manager.budget.maxOutputTokens).toBe(1024);
  });

  it('should check budget status as ok', () => {
    const manager = createBudgetManager({
      maxInputTokens: 4096,
      maxOutputTokens: 1024,
    });

    const status = manager.checkBudget(1000, 500);
    expect(status.status).toBe('ok');
    expect(status.inputTokens).toBe(1000);
    expect(status.outputTokens).toBe(500);
  });

  it('should check budget status as warning', () => {
    const manager = createBudgetManager({
      maxInputTokens: 1000,
      maxOutputTokens: 500,
      warningThreshold: 0.8,
    });

    const status = manager.checkBudget(850, 0);
    expect(status.status).toBe('warning');
  });

  it('should check budget status as critical', () => {
    const manager = createBudgetManager({
      maxInputTokens: 1000,
      maxOutputTokens: 500,
      criticalThreshold: 0.95,
    });

    const status = manager.checkBudget(960, 0);
    expect(status.status).toBe('critical');
  });

  it('should check budget status as exceeded', () => {
    const manager = createBudgetManager({
      maxInputTokens: 1000,
      maxOutputTokens: 500,
    });

    const status = manager.checkBudget(1100, 0);
    expect(status.status).toBe('exceeded');
  });

  it('should calculate remaining tokens', () => {
    const manager = createBudgetManager({
      maxInputTokens: 1000,
      maxOutputTokens: 500,
    });

    const status = manager.checkBudget(300, 200);
    expect(status.remaining.input).toBe(700);
    expect(status.remaining.output).toBe(300);
  });

  it('should calculate utilization', () => {
    const manager = createBudgetManager({
      maxInputTokens: 1000,
      maxOutputTokens: 500,
    });

    const status = manager.checkBudget(500, 250);
    expect(status.inputUtilization).toBe(0.5);
    expect(status.outputUtilization).toBe(0.5);
  });

  it('should validate messages', () => {
    const manager = createBudgetManager({
      maxInputTokens: 1000,
      maxOutputTokens: 500,
    });

    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hello, how are you?' },
      { role: 'assistant', content: 'I am fine, thank you!' },
    ];

    const status = manager.validateMessages(messages);
    expect(status.inputTokens).toBeGreaterThan(0);
    expect(status.status).toBe('ok');
  });

  it('should trim messages to fit budget', () => {
    const manager = createBudgetManager({
      maxInputTokens: 100,
      maxOutputTokens: 50,
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'First message with some content here.' },
      { role: 'assistant', content: 'First response with some content.' },
      { role: 'user', content: 'Second message with more content.' },
      { role: 'assistant', content: 'Second response with more content.' },
      { role: 'user', content: 'Third message.' },
    ];

    const result = manager.trimToFit(messages, { reserveForOutput: 50 });

    expect(result.messages.length).toBeLessThanOrEqual(messages.length);
    // System message should be preserved
    expect(result.messages[0]?.role).toBe('system');
    expect(result.removed.length).toBeGreaterThan(0);
    expect(result.tokensSaved).toBeGreaterThan(0);
  });

  it('should preserve system messages when trimming', () => {
    const manager = createBudgetManager({
      maxInputTokens: 50,
      maxOutputTokens: 50,
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: 'System prompt.' },
      { role: 'user', content: 'User message.' },
    ];

    const result = manager.trimToFit(messages, { preserveSystem: true });
    expect(result.messages.some(m => m.role === 'system')).toBe(true);
  });

  it('should calculate max output tokens', () => {
    const manager = createBudgetManager({
      maxInputTokens: 4096,
      maxOutputTokens: 1024,
    });

    const maxOutput = manager.calculateMaxOutputTokens(2000, 'chat');
    expect(maxOutput).toBeGreaterThan(0);
    expect(maxOutput).toBeLessThanOrEqual(1024);
  });

  it('should update budget', () => {
    const manager = createBudgetManager({
      maxInputTokens: 1000,
      maxOutputTokens: 500,
    });

    manager.updateBudget({ maxInputTokens: 2000 });
    expect(manager.budget.maxInputTokens).toBe(2000);
    expect(manager.budget.maxOutputTokens).toBe(500);
  });
});

describe('MODEL_BUDGETS', () => {
  it('should have GPT-4o budget', () => {
    expect(MODEL_BUDGETS['gpt-4o']).toBeDefined();
    expect(MODEL_BUDGETS['gpt-4o']?.maxInputTokens).toBe(128000);
  });

  it('should have Claude budgets', () => {
    expect(MODEL_BUDGETS['claude-3-opus']).toBeDefined();
    expect(MODEL_BUDGETS['claude-3-5-sonnet']).toBeDefined();
  });

  it('should have Gemini budgets', () => {
    expect(MODEL_BUDGETS['gemini-1.5-pro']).toBeDefined();
    expect(MODEL_BUDGETS['gemini-1.5-pro']?.maxInputTokens).toBe(1048576);
  });
});

describe('getModelBudget', () => {
  it('should return budget for known model', () => {
    const budget = getModelBudget('gpt-4o');
    expect(budget.maxInputTokens).toBe(128000);
  });

  it('should return default budget for unknown model', () => {
    const budget = getModelBudget('unknown-model');
    expect(budget.maxInputTokens).toBeGreaterThan(0);
    expect(budget.maxOutputTokens).toBeGreaterThan(0);
  });

  it('should apply overrides', () => {
    const budget = getModelBudget('gpt-4o', { maxInputTokens: 50000 });
    expect(budget.maxInputTokens).toBe(50000);
    expect(budget.maxOutputTokens).toBe(MODEL_BUDGETS['gpt-4o']?.maxOutputTokens);
  });
});
