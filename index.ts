#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolResult,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import puppeteer, { Browser, Page } from "puppeteer";
import {
  getEmbeddingSentTransformer,
  initializeModelSentTransformer,
  makeRequest,
  semanticSearchRequestsSentTransformer,
} from "./utilities.js";
import {
  getMemoryMetrics,
  takeHeapSnapshot,
  monitorMemory,
  analyzeDetachedDOMNodes,
  formatMemorySize
} from "./memory-utils.js";

import { RequestRecord } from "./types.js";
import { FeatureExtractionPipeline } from "@xenova/transformers";
// Define the tools once to avoid repetition
const TOOLS: Tool[] = [
  {
    name: "puppeteer_navigate",
    description: "Navigate to a URL. If no URL is provided, uses the current URL from the browser window that Cursor AI is targeting.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "puppeteer_page_history",
    description: "Get the history of visited URLs, most recent urls first",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "make_http_request",
    description: "Make an HTTP request with curl",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "Type of the request. GET, POST, PUT, DELETE",
        },
        url: {
          type: "string",
          description: "Url to make the request to",
        },
        headers: {
          type: "object",
          description: "Headers to include in the request",
        },
        body: {
          type: "object",
          description: "Body to include in the request",
        },
      },
      required: ["type", "url", "headers", "body"],
    },
  },
  {
    name: "semantic_search_requests",
    description:
      "Semantically search for requests that occurred within a page URL. Returns the top 10 results.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Your search request. Make this specific and detailed to get the best results",
        },
        page_url: {
          type: "string",
          description: "The page within which to search for requests",
        },
      },
      required: ["query", "page_url"],
    },
  },
  {
    name: "take_heap_snapshot",
    description: "Capture a heap snapshot and analyze memory usage",
    inputSchema: {
      type: "object",
      properties: {
        detailed: {
          type: "boolean",
          description: "Whether to include detailed object information",
        },
      },
      required: [],
    },
  },
  {
    name: "get_memory_metrics",
    description: "Get current memory usage metrics from Chrome",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "start_memory_monitoring",
    description: "Start monitoring memory usage over time to detect leaks",
    inputSchema: {
      type: "object",
      properties: {
        duration: {
          type: "number",
          description: "Duration in seconds to monitor memory (default: 30)",
        },
        interval: {
          type: "number",
          description: "Interval between samples in milliseconds (default: 1000)",
        },
      },
      required: [],
    },
  },
  {
    name: "analyze_detached_dom",
    description: "Analyze detached DOM nodes that might cause memory leaks",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// Global state
let browser: Browser | undefined;
let page: Page | undefined;
const consoleLogs: string[] = [];
const requests: Map<string, RequestRecord[]> = new Map(); // collects all results
const urlHistory: Array<string> = [];

let pipeline: FeatureExtractionPipeline | undefined;

initializeModelSentTransformer().then((sent_pipeline) => {
  console.error("model loaded");
  console.error("model", sent_pipeline);
  pipeline = sent_pipeline;
});

async function ensureBrowser() {
  if (!browser) {
    const npx_args = { headless: false };
    const docker_args = {
      headless: true,
      args: ["--no-sandbox", "--single-process", "--no-zygote"],
    };
    browser = await puppeteer.launch(
      process.env.DOCKER_CONTAINER ? docker_args : npx_args
    );
    const pages = await browser.pages();
    page = pages[0];
    page.setRequestInterception(true);

    // Configure page listeners for logging and request tracking
    page.on("console", (msg) => {
      const logEntry = `[${msg.type()}] ${msg.text()}`;
      consoleLogs.push(logEntry);
      server.notification({
        method: "notifications/resources/updated",
        params: { uri: "console://logs" },
      });
    });

    page.on("request", async (request) => {
      if (!pipeline) {
        console.error(
          "Request made before model was loaded.",
          request.url(),
          page.url()
        );
        request.continue();
        return;
      }
      if (requests.has(page.url())) {
        requests.get(page.url()).unshift({
          url: request.url(),
          resourceType: request.resourceType(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData(),
          embedding: await getEmbeddingSentTransformer(
            request.url() +
              request.method() +
              JSON.stringify(request.headers()) +
              JSON.stringify(request.postData()),
            pipeline
          ),
        });
      } else {
        requests.set(page.url(), [
          {
            url: request.url(),
            resourceType: request.resourceType(),
            method: request.method(),
            headers: request.headers(),
            postData: request.postData(),
            embedding: await getEmbeddingSentTransformer(
              request.url() +
                request.method() +
                JSON.stringify(request.headers()) +
                JSON.stringify(request.postData()),
              pipeline
            ),
          },
        ]);
      }
      request.continue();
    });
    
    // Navigate to localhost:5173 by default
    try {
      console.log("Navigating to default development server at http://localhost:5173/");
      await page.goto("http://localhost:5173/", { waitUntil: 'networkidle0' });
      urlHistory.push("http://localhost:5173/");
      console.log("Successfully navigated to http://localhost:5173/");
    } catch (error) {
      console.error("Failed to navigate to http://localhost:5173/ - falling back to default:", error);
    }
  }
  return page!;
}

declare global {
  interface Window {
    mcpHelper: {
      logs: string[];
      originalConsole: Partial<typeof console>;
    };
  }
}

async function handleToolCall(
  name: string,
  args: any
): Promise<CallToolResult> {
  const page = await ensureBrowser();
  switch (name) {
    case "puppeteer_navigate":
      const targetUrl = args.url || await page.evaluate(() => window.location.href);
      await page.goto(targetUrl);
      return {
        content: [
          {
            type: "text",
            text: `Navigated to ${targetUrl}`,
          },
        ],
        isError: false,
      };

    case "page_history":
      return {
        content: [
          {
            type: "text",
            text: urlHistory.reverse().join("\n"),
          },
        ],
        isError: false,
      };

    case "make_http_request": {
      const response = await makeRequest(
        args.url,
        args.type,
        args.headers,
        args.body
      );
      return {
        content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
        isError: false,
      };
    }

    case "semantic_search_requests": {
      if (!pipeline) {
        return {
          content: [{ type: "text", text: "Model not defined" }],
          isError: true,
        };
      }
      const searchResults = await semanticSearchRequestsSentTransformer(
        args.query,
        requests.get(args.page_url),
        pipeline
      );
      const withoutEmbedding = searchResults.map(
        ({ embedding, similarity, ...rest }) => rest
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(withoutEmbedding, null, 2) },
        ],
        isError: false,
      };
    }
    
    case "take_heap_snapshot": {
      try {
        const detailed = args.detailed === true;
        const snapshot = await takeHeapSnapshot(page, detailed);
        
        // Format results to be more human-readable
        const formattedResult = {
          ...snapshot,
          totalSize: formatMemorySize(snapshot.totalSize),
          largeObjects: snapshot.largeObjects.map(obj => ({
            ...obj,
            size: formatMemorySize(obj.size)
          }))
        };
        
        return {
          content: [
            { 
              type: "text", 
              text: `Heap Snapshot Analysis:\n${JSON.stringify(formattedResult, null, 2)}` 
            }
          ],
          isError: false
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error taking heap snapshot: ${error.message}` }],
          isError: true
        };
      }
    }
    
    case "get_memory_metrics": {
      try {
        const metrics = await getMemoryMetrics(page);
        
        // Format the metrics to be more readable
        const formattedMetrics = {
          jsHeapSizeLimit: formatMemorySize(metrics.jsHeapSizeLimit),
          totalJSHeapSize: formatMemorySize(metrics.totalJSHeapSize),
          usedJSHeapSize: formatMemorySize(metrics.usedJSHeapSize),
          timestamp: new Date(metrics.timestamp).toISOString(),
          usagePercentage: ((metrics.usedJSHeapSize / metrics.jsHeapSizeLimit) * 100).toFixed(2) + '%'
        };
        
        return {
          content: [
            { 
              type: "text",
              text: `Current Memory Metrics:\n${JSON.stringify(formattedMetrics, null, 2)}`
            }
          ],
          isError: false
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting memory metrics: ${error.message}` }],
          isError: true
        };
      }
    }
    
    case "start_memory_monitoring": {
      try {
        const duration = args.duration || 30; // Default 30 seconds
        const interval = args.interval || 1000; // Default 1 second
        
        // Start the monitoring process
        const timeline = await monitorMemory(page, duration, interval);
        
        // Format the timeline data
        const formattedTimeline = timeline.map(point => ({
          timestamp: new Date(point.timestamp).toISOString(),
          metrics: {
            jsHeapSizeLimit: formatMemorySize(point.metrics.jsHeapSizeLimit),
            totalJSHeapSize: formatMemorySize(point.metrics.totalJSHeapSize),
            usedJSHeapSize: formatMemorySize(point.metrics.usedJSHeapSize),
            usagePercentage: ((point.metrics.usedJSHeapSize / point.metrics.jsHeapSizeLimit) * 100).toFixed(2) + '%'
          }
        }));
        
        // Calculate growth rate
        const firstPoint = timeline[0];
        const lastPoint = timeline[timeline.length - 1];
        const memoryGrowth = lastPoint.metrics.usedJSHeapSize - firstPoint.metrics.usedJSHeapSize;
        const timeElapsed = (lastPoint.timestamp - firstPoint.timestamp) / 1000; // in seconds
        const growthRate = memoryGrowth / timeElapsed; // bytes per second
        
        // Analyze for potential leaks
        const hasLeak = growthRate > 10000; // More than 10KB/sec might indicate a leak
        
        const analysis = {
          sampleCount: timeline.length,
          duration: `${duration} seconds`,
          interval: `${interval} ms`,
          memoryGrowth: formatMemorySize(memoryGrowth),
          growthRate: `${formatMemorySize(growthRate)}/sec`,
          potentialLeak: hasLeak,
          recommendation: hasLeak 
            ? "Potential memory leak detected. Consider investigating detached DOM nodes or closure references."
            : "No significant memory growth detected.",
          timeline: formattedTimeline
        };
        
        return {
          content: [
            { 
              type: "text",
              text: `Memory Monitoring Results:\n${JSON.stringify(analysis, null, 2)}`
            }
          ],
          isError: false
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error monitoring memory: ${error.message}` }],
          isError: true
        };
      }
    }
    
    case "analyze_detached_dom": {
      try {
        const detachedNodes = await analyzeDetachedDOMNodes(page);
        
        // Format the results
        const summary = {
          detachedNodeCount: detachedNodes.length,
          totalRetainedSize: formatMemorySize(
            detachedNodes.reduce((sum, node) => sum + node.retainedSize, 0)
          ),
          detachedNodes: detachedNodes.map(node => ({
            ...node,
            retainedSize: formatMemorySize(node.retainedSize)
          }))
        };
        
        // Add recommendations
        const recommendations = detachedNodes.length > 0 
          ? [
              "Consider cleaning up event listeners on elements before removing them from the DOM",
              "Check for references to DOM elements in closures or global variables",
              "Use WeakMap/WeakSet for storing DOM references",
              "Implement proper component cleanup in frameworks"
            ]
          : ["No detached DOM nodes found that might cause memory leaks"];
        
        return {
          content: [
            {
              type: "text",
              text: `Detached DOM Analysis:\n${JSON.stringify({...summary, recommendations}, null, 2)}`
            }
          ],
          isError: false
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error analyzing detached DOM: ${error.message}` }],
          isError: true
        };
      }
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

const server = new Server(
  {
    name: "mcp-scrape-copilot",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) =>
  handleToolCall(request.params.name, request.params.arguments ?? {})
);

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch(console.error);

process.stdin.on("close", () => {
  console.error("Puppeteer MCP Server closed");
  server.close();
});
