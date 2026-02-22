import * as core from '@actions/core';

/**
 * Structured logging utility
 */
export const logger = {
  debug: (message: string): void => {
    core.debug(message);
  },

  info: (message: string): void => {
    core.info(message);
  },

  warning: (message: string): void => {
    core.warning(message);
  },

  error: (message: string): void => {
    core.error(message);
  },

  group: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    core.startGroup(name);
    try {
      return await fn();
    } finally {
      core.endGroup();
    }
  },
};
