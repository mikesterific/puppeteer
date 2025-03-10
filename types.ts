export interface RequestRecord {
  url: string;
  method: string;
  headers: Record<string, string>;
  resourceType: string;
  postData: any;
  embedding: number[];
}

export interface MemoryMetrics {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
  timestamp: number;
}

export interface HeapSnapshotSummary {
  totalObjects: number;
  totalSize: number;
  nodeCount: number;
  detachedDomTreesCount: number;
  windowCount: number;
  documentCount: number;
  largeObjects: Array<{type: string, count: number, size: number}>;
}

export interface MemoryTimelinePoint {
  metrics: MemoryMetrics;
  timestamp: number;
}

export interface DetachedDOMNode {
  id: string;
  nodeName: string;
  nodeType: number;
  children: number;
  retainedSize: number;
}
