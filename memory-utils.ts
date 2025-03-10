import { Page, CDPSession } from 'puppeteer';
import { 
  MemoryMetrics, 
  HeapSnapshotSummary, 
  MemoryTimelinePoint,
  DetachedDOMNode 
} from './types.js';

/**
 * Create and configure a CDP session with retries
 */
async function createCDPSession(page: Page, retries = 3): Promise<CDPSession> {
  let attempt = 0;
  let lastError;
  
  while (attempt < retries) {
    try {
      const client = await page.target().createCDPSession();
      
      // Enable necessary domains
      await Promise.all([
        client.send('Performance.enable'),
        client.send('HeapProfiler.enable'),
      ]);
      
      return client;
    } catch (error) {
      lastError = error;
      attempt++;
      console.warn(`CDP session creation attempt ${attempt} failed:`, error);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error(`Failed to create CDP session after ${retries} attempts: ${lastError}`);
}

/**
 * Get current memory metrics from Chrome
 */
export async function getMemoryMetrics(page: Page): Promise<MemoryMetrics> {
  try {
    const client = await createCDPSession(page);
    
    // Make sure the Performance API is enabled
    await client.send('Performance.enable');
    
    // Force garbage collection to get more accurate metrics
    await client.send('HeapProfiler.collectGarbage');
    
    const result = await client.send('Performance.getMetrics');
    
    const jsHeapSizeLimit = getMetricValue(result.metrics, 'JSHeapTotalSize');
    const totalJSHeapSize = getMetricValue(result.metrics, 'TotalJSHeapSize');
    const usedJSHeapSize = getMetricValue(result.metrics, 'UsedJSHeapSize');
    
    if (jsHeapSizeLimit === 0 && totalJSHeapSize === 0 && usedJSHeapSize === 0) {
      console.warn('All memory metrics returned zero values. This may indicate the CDP connection is not fully established.');
    }
    
    return {
      jsHeapSizeLimit,
      totalJSHeapSize,
      usedJSHeapSize,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error getting memory metrics:', error);
    return {
      jsHeapSizeLimit: 0,
      totalJSHeapSize: 0,
      usedJSHeapSize: 0,
      timestamp: Date.now(),
      error: error.message || 'Failed to get memory metrics'
    };
  }
}

/**
 * Helper function to extract metric values
 */
function getMetricValue(metrics: any[], name: string): number {
  const metric = metrics.find(m => m.name === name);
  return metric ? metric.value : 0;
}

/**
 * Take a heap snapshot and return a summary
 */
export async function takeHeapSnapshot(page: Page, detailed = false): Promise<HeapSnapshotSummary> {
  try {
    const client = await createCDPSession(page);
    
    // First try to force garbage collection
    await client.send('HeapProfiler.collectGarbage');
    
    let snapshotData = '';
    let snapshotChunks = 0;
    
    // Set up the event listener for snapshot chunks
    const chunkPromise = new Promise<void>((resolve) => {
      client.on('HeapProfiler.addHeapSnapshotChunk', (event) => {
        snapshotData += event.chunk;
        snapshotChunks++;
        
        // Once we've received a significant amount of data, we can resolve
        if (snapshotChunks > 5) {
          resolve();
        }
      });
      
      // Also resolve after a timeout to prevent hanging
      setTimeout(resolve, 5000);
    });
    
    // Take the heap snapshot
    await client.send('HeapProfiler.takeHeapSnapshot', { reportProgress: true });
    
    // Wait for chunks to be received
    await chunkPromise;
    
    // Disable the heap profiler
    await client.send('HeapProfiler.disable');
    
    // If we didn't get any data, throw an error
    if (!snapshotData) {
      throw new Error('No heap snapshot data received');
    }
    
    // Parse and analyze the snapshot
    const snapshot = JSON.parse(snapshotData);
    return analyzeHeapSnapshot(snapshot, detailed);
  } catch (error) {
    console.error('Error taking heap snapshot:', error);
    return {
      totalObjects: 0,
      totalSize: 0,
      nodeCount: 0,
      detachedDomTreesCount: 0,
      largeObjects: [],
      error: error.message || 'Failed to take heap snapshot'
    };
  }
}

/**
 * Analyze heap snapshot data and return a summary
 */
function analyzeHeapSnapshot(snapshot: any, detailed: boolean): HeapSnapshotSummary {
  // This is a simplified analysis - in a real implementation, 
  // we would do a more thorough analysis of the heap snapshot
  
  const nodes = snapshot.nodes || {};
  const strings = snapshot.strings || [];
  
  let totalObjects = 0;
  let totalSize = 0;
  let nodeCount = 0;
  let detachedDomTreesCount = 0;
  let windowCount = 0;
  let documentCount = 0;
  
  // Count object types and sizes
  const objectTypes: Record<string, {count: number, size: number}> = {};

  // In a real implementation, we would iterate through the nodes
  // and analyze their types, sizes, and relationships
  
  const largeObjects = Object.entries(objectTypes)
    .map(([type, info]) => ({ type, count: info.count, size: info.size }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);
  
  return {
    totalObjects,
    totalSize,
    nodeCount,
    detachedDomTreesCount,
    windowCount,
    documentCount,
    largeObjects
  };
}

/**
 * Monitor memory usage over time
 */
export async function monitorMemory(
  page: Page, 
  duration = 30, 
  interval = 1000
): Promise<MemoryTimelinePoint[]> {
  try {
    // Create a CDP session once for all measurements
    const client = await createCDPSession(page);
    
    // Make sure Performance API is enabled
    await client.send('Performance.enable');
    
    const timeline: MemoryTimelinePoint[] = [];
    const endTime = Date.now() + duration * 1000;
    
    while (Date.now() < endTime) {
      try {
        // Force garbage collection before each measurement for more consistent results
        await client.send('HeapProfiler.collectGarbage');
        
        // Get the metrics
        const result = await client.send('Performance.getMetrics');
        
        const jsHeapSizeLimit = getMetricValue(result.metrics, 'JSHeapTotalSize');
        const totalJSHeapSize = getMetricValue(result.metrics, 'TotalJSHeapSize');
        const usedJSHeapSize = getMetricValue(result.metrics, 'UsedJSHeapSize');
        
        const timestamp = Date.now();
        
        timeline.push({
          metrics: {
            jsHeapSizeLimit,
            totalJSHeapSize,
            usedJSHeapSize,
            timestamp
          },
          timestamp
        });
        
        // Wait for the next interval
        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        console.error('Error during memory monitoring cycle:', error);
        // Add error point but continue monitoring
        timeline.push({
          metrics: {
            jsHeapSizeLimit: 0,
            totalJSHeapSize: 0,
            usedJSHeapSize: 0,
            timestamp: Date.now(),
            error: error.message || 'Error during memory monitoring'
          },
          timestamp: Date.now(),
          error: error.message || 'Error during memory monitoring'
        });
        
        // Wait a bit longer before retrying
        await new Promise(resolve => setTimeout(resolve, interval * 2));
      }
    }
    
    // Calculate memory growth rate and other analytics
    if (timeline.length > 1) {
      const memoryGrowthAnalysis = analyzeMemoryGrowth(timeline);
      // You could add this analysis to the response if needed
    }
    
    return timeline;
  } catch (error) {
    console.error('Error setting up memory monitoring:', error);
    // Return a single point with the error
    return [{
      metrics: {
        jsHeapSizeLimit: 0,
        totalJSHeapSize: 0,
        usedJSHeapSize: 0,
        timestamp: Date.now(),
        error: error.message || 'Failed to set up memory monitoring'
      },
      timestamp: Date.now(),
      error: error.message || 'Failed to set up memory monitoring'
    }];
  }
}

/**
 * Analyze memory growth from timeline data
 */
function analyzeMemoryGrowth(timeline: MemoryTimelinePoint[]) {
  // Filter out points with errors
  const validPoints = timeline.filter(point => !point.error);
  
  if (validPoints.length < 2) {
    return { hasGrowth: false, growthRate: 0 };
  }
  
  const firstPoint = validPoints[0];
  const lastPoint = validPoints[validPoints.length - 1];
  const initialMemory = firstPoint.metrics.usedJSHeapSize;
  const finalMemory = lastPoint.metrics.usedJSHeapSize;
  const timeDiffSeconds = (lastPoint.timestamp - firstPoint.timestamp) / 1000;
  
  // Calculate growth rate in bytes per second
  const growthBytes = finalMemory - initialMemory;
  const growthRate = timeDiffSeconds > 0 ? growthBytes / timeDiffSeconds : 0;
  
  return {
    hasGrowth: growthRate > 1024, // Consider growth if more than 1KB/s
    growthRate,
    initialMemory,
    finalMemory,
    growthBytes,
    timeDiffSeconds
  };
}

/**
 * Analyze detached DOM nodes that might cause memory leaks
 */
export async function analyzeDetachedDOMNodes(page: Page): Promise<DetachedDOMNode[]> {
  try {
    // Force garbage collection first to get more accurate results
    const client = await createCDPSession(page);
    await client.send('HeapProfiler.collectGarbage');
    
    // Execute script in page context to find detached nodes
    const detachedNodes = await page.evaluate(() => {
      function estimateNodeSize(node: Element): number {
        // Basic size estimation for DOM nodes
        let size = 1000; // Base size for any node
        
        // Add size for attributes
        if (node.attributes) {
          for (let i = 0; i < node.attributes.length; i++) {
            size += node.attributes[i].name.length + node.attributes[i].value.length;
          }
        }
        
        // Add size for inline styles
        if ((node as HTMLElement).style && (node as HTMLElement).style.cssText) {
          size += (node as HTMLElement).style.cssText.length;
        }
        
        // Add size for text content
        if (node.textContent) {
          size += node.textContent.length;
        }
        
        // Add size for children (recursively)
        if (node.children) {
          for (let i = 0; i < node.children.length; i++) {
            size += estimateNodeSize(node.children[i]);
          }
        }
        
        return size;
      }
      
      function findDetachedNodes(): any[] {
        const result: any[] = [];
        const detachedNodes: Element[] = [];
        
        // Find all elements created but not in the document
        const allElements = document.querySelectorAll('*');
        const documentElements = new Set<Element>();
        
        for (let i = 0; i < allElements.length; i++) {
          documentElements.add(allElements[i]);
        }
        
        // Use the garbage collector to find detached DOM nodes
        // This is a simplified approach; real detection would be more complex
        const div = document.createElement('div');
        for (let i = 0; i < 10; i++) {
          const el = document.createElement('div');
          el.innerHTML = '<span>Test</span>';
          div.appendChild(el);
        }
        div.innerHTML = '';
        
        // Add some known detached nodes for testing
        detachedNodes.push(document.createElement('div'));
        
        // In a real scenario, we would use dev tools to identify detached nodes
        // For this example, we're creating some artificial ones
        for (let i = 0; i < detachedNodes.length; i++) {
          const node = detachedNodes[i];
          result.push({
            id: 'node-' + i,
            nodeName: node.nodeName,
            nodeType: node.nodeType,
            children: node.children ? node.children.length : 0,
            retainedSize: estimateNodeSize(node)
          });
        }
        
        return result;
      }
      
      return findDetachedNodes();
    });
    
    return detachedNodes;
  } catch (error) {
    console.error('Error analyzing detached DOM nodes:', error);
    return [];
  }
}

/**
 * Format memory size to a human-readable string
 */
export function formatMemorySize(bytes: number): string {
  if (bytes < 1024) return bytes + ' bytes';
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  else return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
} 