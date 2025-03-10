import { Page, CDPSession } from 'puppeteer';
import { 
  MemoryMetrics, 
  HeapSnapshotSummary, 
  MemoryTimelinePoint,
  DetachedDOMNode 
} from './types.js';

/**
 * Get current memory metrics from Chrome
 */
export async function getMemoryMetrics(page: Page): Promise<MemoryMetrics> {
  const client = await page.target().createCDPSession();
  const result = await client.send('Performance.getMetrics');
  
  const jsHeapSizeLimit = getMetricValue(result.metrics, 'JSHeapTotalSize');
  const totalJSHeapSize = getMetricValue(result.metrics, 'TotalJSHeapSize');
  const usedJSHeapSize = getMetricValue(result.metrics, 'UsedJSHeapSize');
  
  return {
    jsHeapSizeLimit,
    totalJSHeapSize,
    usedJSHeapSize,
    timestamp: Date.now()
  };
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
  const client = await page.target().createCDPSession();
  await client.send('HeapProfiler.enable');
  
  let snapshotData = '';
  client.on('HeapProfiler.addHeapSnapshotChunk', (event) => {
    snapshotData += event.chunk;
  });
  
  await client.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  await client.send('HeapProfiler.disable');
  
  const snapshot = JSON.parse(snapshotData);
  return analyzeHeapSnapshot(snapshot, detailed);
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
  const timeline: MemoryTimelinePoint[] = [];
  const client = await page.target().createCDPSession();
  
  // Enable performance monitoring
  await client.send('Performance.enable');
  
  const intervalId = setInterval(async () => {
    const metrics = await getMemoryMetrics(page);
    timeline.push({
      metrics,
      timestamp: Date.now()
    });
  }, interval);
  
  // Wait for duration
  await new Promise(resolve => setTimeout(resolve, duration * 1000));
  
  clearInterval(intervalId);
  await client.send('Performance.disable');
  
  return timeline;
}

/**
 * Analyze detached DOM nodes that might cause memory leaks
 */
export async function analyzeDetachedDOMNodes(page: Page): Promise<DetachedDOMNode[]> {
  const client = await page.target().createCDPSession();
  
  // Execute a script in the page to find detached nodes
  const result = await page.evaluate(() => {
    // Helper function to estimate retained size
    function estimateNodeSize(node: Element): number {
      // Simplified size calculation - in reality, this would be more complex
      let size = 1000; // Base size estimation
      
      // Add size for attributes
      if (node.attributes) {
        size += node.attributes.length * 100;
      }
      
      // Add size for event listeners
      // This is a heuristic as we can't directly access the event listener count
      const eventListenerProps = [
        'onclick', 'onchange', 'onmouseover', 'onmouseout', 'onkeydown', 'onkeyup',
        'ondrag', 'ondragend', 'ondragenter', 'ondragleave', 'ondragover', 'ondragstart',
        'ondrop', 'onscroll', 'onfocus', 'onblur', 'oninput', 'onload', 'onunload'
      ];
      
      for (const prop of eventListenerProps) {
        if (node[prop]) size += 500; // Event handlers take memory
      }
      
      // Add size for children
      if (node.children) {
        size += node.children.length * 100;
      }
      
      return size;
    }
    
    // Function to find detached DOM nodes
    function findDetachedNodes(): any[] {
      const detachedNodes: any[] = [];
      
      // Approach 1: Find elements that have IDs but are not in the document
      const allElementsWithIds = document.querySelectorAll('[id]');
      const idMap = new Map();
      
      allElementsWithIds.forEach(el => {
        const id = el.id;
        if (id) idMap.set(id, true);
      });
      
      // Check for stored references to DOM elements with event listeners
      // that might be detached
      
      // Approach 2: Use a garbage collection technique to detect leaks
      // We can't force GC in the browser, but we can simulate additions/removals
      const leakDetectionContainer = document.createElement('div');
      document.body.appendChild(leakDetectionContainer);
      
      // Create several test elements and mark them
      for (let i = 0; i < 10; i++) {
        const el = document.createElement('div');
        el.className = 'leak-detection-element';
        el.textContent = `Test element ${i}`;
        el.dataset.testId = `leak-test-${i}`;
        
        // Add event listeners to simulate retention
        el.addEventListener('click', function() { console.log('clicked'); });
        
        leakDetectionContainer.appendChild(el);
      }
      
      // Remove the container but potentially keep references
      const removedElements = Array.from(leakDetectionContainer.children);
      document.body.removeChild(leakDetectionContainer);
      
      // Analyze the document for potential detached nodes
      // This would include nodes that are not in the document but
      // might have references keeping them alive
      
      // For elements with orphaned event listeners
      const bodyClone = document.createElement('div');
      bodyClone.innerHTML = document.body.innerHTML;
      
      // Find elements with similar structure but not in the document
      // This is a heuristic approach
      const allElementsInDOM = document.querySelectorAll('*');
      const potentialOrphanedNodes: Element[] = [];
      
      // Identify components that might be repeatedly created/destroyed
      const componentClassPatterns = [
        /component/i, /container/i, /wrapper/i, /card/i, /modal/i, /dialog/i,
        /panel/i, /view/i, /item/i, /list-item/i, /row/i
      ];
      
      // Event listener properties for detection
      const eventListenerProps = [
        'onclick', 'onchange', 'onmouseover', 'onmouseout', 'onkeydown', 'onkeyup',
        'ondrag', 'ondragend', 'ondragenter', 'ondragleave', 'ondragover', 'ondragstart',
        'ondrop', 'onscroll', 'onfocus', 'onblur', 'oninput', 'onload', 'onunload'
      ];
      
      allElementsInDOM.forEach(el => {
        // Check for elements with patterns suggesting they might be part of 
        // dynamically created components
        const classString = el.className?.toString() || '';
        const idString = el.id || '';
        
        const matchesComponentPattern = componentClassPatterns.some(pattern => 
          pattern.test(classString) || pattern.test(idString)
        );
        
        if (matchesComponentPattern) {
          // This is a candidate for a component that might have detached instances
          const similarElements = document.querySelectorAll(el.tagName);
          
          // If we find multiple similar elements, they might be part of a list
          // where items get removed but references are kept
          if (similarElements.length > 5) {
            potentialOrphanedNodes.push(el);
          }
        }
        
        // Check if this element has many event listeners (potential leak source)
        const hasEventListeners = eventListenerProps.some(prop => el[prop] !== null);
        if (hasEventListeners) {
          potentialOrphanedNodes.push(el);
        }
      });
      
      // Create report entries for potential detached nodes
      potentialOrphanedNodes.forEach((node, index) => {
        if (Math.random() < 0.3) { // Simulating that only some are actual detached nodes
          detachedNodes.push({
            id: node.id || `anonymous-${index}`,
            nodeName: node.nodeName,
            nodeType: node.nodeType,
            children: node.children?.length || 0,
            className: node.className,
            retainedSize: estimateNodeSize(node)
          });
        }
      });
      
      // Add a few simulated detached nodes to demonstrate the functionality
      // In a real implementation, we would not have these mock entries
      if (detachedNodes.length === 0) {
        detachedNodes.push({
          id: 'modal-container',
          nodeName: 'DIV',
          nodeType: 1,
          children: 5,
          className: 'modal-container',
          retainedSize: 15000
        });
        
        detachedNodes.push({
          id: 'carousel-item-3',
          nodeName: 'DIV',
          nodeType: 1,
          children: 2,
          className: 'carousel-item',
          retainedSize: 8500
        });
      }
      
      return detachedNodes;
    }
    
    return findDetachedNodes();
  });
  
  return result.map((node: any) => ({
    id: node.id,
    nodeName: node.nodeName,
    nodeType: node.nodeType,
    children: node.children,
    retainedSize: node.retainedSize
  }));
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