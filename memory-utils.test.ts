import puppeteer, { Browser, Page } from 'puppeteer';
import {
  getMemoryMetrics,
  takeHeapSnapshot,
  monitorMemory,
  analyzeDetachedDOMNodes,
  formatMemorySize
} from './memory-utils.js';
import { jest } from '@jest/globals';

// Mock puppeteer
jest.mock('puppeteer', () => {
  // Create mock implementations for CDP session
  const mockCDPSession = {
    send: jest.fn().mockImplementation((method, params) => {
      if (method === 'Performance.getMetrics') {
        return {
          metrics: [
            { name: 'JSHeapTotalSize', value: 50 * 1024 * 1024 },
            { name: 'TotalJSHeapSize', value: 100 * 1024 * 1024 },
            { name: 'UsedJSHeapSize', value: 40 * 1024 * 1024 }
          ]
        };
      }
      
      if (method === 'HeapProfiler.takeHeapSnapshot') {
        return {};
      }
      
      if (method === 'HeapProfiler.enable' || method === 'HeapProfiler.disable') {
        return {};
      }
      
      if (method === 'Performance.enable' || method === 'Performance.disable') {
        return {};
      }
      
      return {};
    }),
    on: jest.fn().mockImplementation((event, callback) => {
      if (event === 'HeapProfiler.addHeapSnapshotChunk') {
        callback({ chunk: JSON.stringify({
          nodes: {},
          strings: [],
        }) });
      }
    })
  };
  
  // Create mock implementation for page
  const mockPage = {
    evaluate: jest.fn().mockImplementation(() => {
      return [
        {
          id: 'test-node-1',
          nodeName: 'DIV',
          nodeType: 1,
          children: 3,
          retainedSize: 5000
        },
        {
          id: 'test-node-2',
          nodeName: 'SPAN',
          nodeType: 1,
          children: 0,
          retainedSize: 2000
        }
      ];
    }),
    target: jest.fn().mockReturnValue({
      createCDPSession: jest.fn().mockResolvedValue(mockCDPSession)
    })
  };
  
  return {
    launch: jest.fn().mockResolvedValue({
      pages: jest.fn().mockResolvedValue([mockPage])
    }),
    __mockPage: mockPage,
    __mockCDPSession: mockCDPSession
  };
});

// Get access to mocks
const mockPuppeteer = puppeteer as unknown as jest.Mocked<typeof puppeteer> & {
  __mockPage: jest.Mocked<Page>;
  __mockCDPSession: any;
};

describe('Memory Profiling Utilities', () => {
  let mockPage: jest.Mocked<Page>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockPage = mockPuppeteer.__mockPage as unknown as jest.Mocked<Page>;
    
    // Mock Date.now() to return consistent timestamps
    jest.spyOn(Date, 'now').mockReturnValue(1000);
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('getMemoryMetrics', () => {
    it('should retrieve memory metrics from Chrome DevTools Protocol', async () => {
      const metrics = await getMemoryMetrics(mockPage);
      
      expect(mockPage.target).toHaveBeenCalled();
      expect(mockPuppeteer.__mockCDPSession.send).toHaveBeenCalledWith('Performance.getMetrics');
      
      expect(metrics).toEqual({
        jsHeapSizeLimit: 50 * 1024 * 1024,
        totalJSHeapSize: 100 * 1024 * 1024,
        usedJSHeapSize: 40 * 1024 * 1024,
        timestamp: 1000
      });
    });
  });
  
  describe('takeHeapSnapshot', () => {
    it('should take a heap snapshot and return a summary', async () => {
      const snapshot = await takeHeapSnapshot(mockPage, false);
      
      expect(mockPage.target).toHaveBeenCalled();
      expect(mockPuppeteer.__mockCDPSession.send).toHaveBeenCalledWith('HeapProfiler.enable');
      expect(mockPuppeteer.__mockCDPSession.send).toHaveBeenCalledWith('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
      expect(mockPuppeteer.__mockCDPSession.send).toHaveBeenCalledWith('HeapProfiler.disable');
      
      expect(snapshot).toHaveProperty('totalObjects');
      expect(snapshot).toHaveProperty('totalSize');
      expect(snapshot).toHaveProperty('largeObjects');
    });
  });
  
  describe('analyzeDetachedDOMNodes', () => {
    it('should analyze detached DOM nodes', async () => {
      const detachedNodes = await analyzeDetachedDOMNodes(mockPage);
      
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(detachedNodes).toHaveLength(2);
      expect(detachedNodes[0]).toEqual({
        id: 'test-node-1',
        nodeName: 'DIV',
        nodeType: 1,
        children: 3,
        retainedSize: 5000
      });
    });
  });
  
  describe('formatMemorySize', () => {
    it('should format memory size in bytes', () => {
      expect(formatMemorySize(500)).toBe('500 bytes');
    });
    
    it('should format memory size in KB', () => {
      expect(formatMemorySize(1500)).toBe('1.46 KB');
    });
    
    it('should format memory size in MB', () => {
      expect(formatMemorySize(1500000)).toBe('1.43 MB');
    });
    
    it('should format memory size in GB', () => {
      expect(formatMemorySize(1500000000)).toBe('1.40 GB');
    });
  });
  
  describe('monitorMemory', () => {
    it('should monitor memory usage over time', async () => {
      // Setup for time progression
      const dateSpy = jest.spyOn(Date, 'now');
      dateSpy
        .mockReturnValueOnce(1000) // Initial time
        .mockReturnValueOnce(2000) // First sample
        .mockReturnValueOnce(3000); // Second sample
      
      // Mock setInterval/setTimeout
      jest.useFakeTimers();
      
      // Start monitoring (will use mocked timers)
      const monitorPromise = monitorMemory(mockPage, 2, 1000);
      
      // Fast-forward time to trigger the interval callback
      jest.advanceTimersByTime(1000);
      jest.advanceTimersByTime(1000);
      
      // Fast-forward the full duration
      jest.advanceTimersByTime(2000);
      
      // Resolve the promise
      const timeline = await monitorPromise;
      
      // Verify CDP interactions
      expect(mockPage.target).toHaveBeenCalled();
      expect(mockPuppeteer.__mockCDPSession.send).toHaveBeenCalledWith('Performance.enable');
      expect(mockPuppeteer.__mockCDPSession.send).toHaveBeenCalledWith('Performance.disable');
      
      // We might have multiple samples depending on the timing
      expect(timeline.length).toBeGreaterThan(0);
    });
  });
}); 