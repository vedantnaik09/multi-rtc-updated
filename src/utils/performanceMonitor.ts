// Performance monitoring utility for WebRTC optimization
export class WebRTCPerformanceMonitor {
  private static instance: WebRTCPerformanceMonitor;
  private metrics: Map<string, number> = new Map();
  private startTimes: Map<string, number> = new Map();

  static getInstance(): WebRTCPerformanceMonitor {
    if (!WebRTCPerformanceMonitor.instance) {
      WebRTCPerformanceMonitor.instance = new WebRTCPerformanceMonitor();
    }
    return WebRTCPerformanceMonitor.instance;
  }

  startTiming(operation: string): void {
    this.startTimes.set(operation, performance.now());
  }

  endTiming(operation: string): number {
    const startTime = this.startTimes.get(operation);
    if (!startTime) {
      console.warn(`No start time found for operation: ${operation}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.metrics.set(operation, duration);
    this.startTimes.delete(operation);

    console.log(`⚡ ${operation}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  getMetric(operation: string): number | undefined {
    return this.metrics.get(operation);
  }

  getAllMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  logSummary(): void {
    console.group('🚀 WebRTC Performance Summary');
    
    const joinTime = this.metrics.get('total_join_time');
    const connectionsTime = this.metrics.get('parallel_connections_time');
    const signalingTime = this.metrics.get('firebase_signaling_time');
    
    if (joinTime) console.log(`Total Join Time: ${joinTime.toFixed(2)}ms`);
    if (connectionsTime) console.log(`Parallel Connections: ${connectionsTime.toFixed(2)}ms`);
    if (signalingTime) console.log(`Firebase Signaling: ${signalingTime.toFixed(2)}ms`);
    
    console.groupEnd();
  }

  reset(): void {
    this.metrics.clear();
    this.startTimes.clear();
  }
}

// Connection state tracking
export class ConnectionStateTracker {
  private static connections: Map<number, {
    state: RTCPeerConnectionState;
    startTime: number;
    connectedTime?: number;
  }> = new Map();

  static trackConnection(index: number, pc: RTCPeerConnection): void {
    this.connections.set(index, {
      state: pc.connectionState,
      startTime: performance.now()
    });

    pc.addEventListener('connectionstatechange', () => {
      const connection = this.connections.get(index);
      if (connection) {
        connection.state = pc.connectionState;
        
        if (pc.connectionState === 'connected' && !connection.connectedTime) {
          connection.connectedTime = performance.now();
          const duration = connection.connectedTime - connection.startTime;
          console.log(`🔗 Connection ${index} established in ${duration.toFixed(2)}ms`);
        }
      }
    });
  }

  static getConnectionStats(): Array<{
    index: number;
    state: RTCPeerConnectionState;
    duration?: number;
  }> {
    return Array.from(this.connections.entries()).map(([index, conn]) => ({
      index,
      state: conn.state,
      duration: conn.connectedTime ? conn.connectedTime - conn.startTime : undefined
    }));
  }

  static getAverageConnectionTime(): number {
    const connections = Array.from(this.connections.values());
    const connectedConnections = connections.filter(c => c.connectedTime);
    
    if (connectedConnections.length === 0) return 0;
    
    const totalTime = connectedConnections.reduce(
      (sum, conn) => sum + (conn.connectedTime! - conn.startTime), 
      0
    );
    
    return totalTime / connectedConnections.length;
  }
}

// Firebase operation monitoring
export class FirebaseOpMonitor {
  private static operations: Array<{
    operation: string;
    duration: number;
    timestamp: number;
  }> = [];

  static logOperation(operation: string, duration: number): void {
    this.operations.push({
      operation,
      duration,
      timestamp: Date.now()
    });
  }

  static getRecentOperations(windowMs: number = 10000): Array<{
    operation: string;
    duration: number;
    timestamp: number;
  }> {
    const cutoff = Date.now() - windowMs;
    return this.operations.filter(op => op.timestamp > cutoff);
  }

  static getAverageOperationTime(operation: string): number {
    const ops = this.operations.filter(op => op.operation === operation);
    if (ops.length === 0) return 0;
    
    return ops.reduce((sum, op) => sum + op.duration, 0) / ops.length;
  }
}

// Usage helper for hooks
export const usePerformanceMonitor = () => {
  const monitor = WebRTCPerformanceMonitor.getInstance();

  const trackJoinProcess = async (joinFn: () => Promise<void>) => {
    monitor.startTiming('total_join_time');
    try {
      await joinFn();
    } finally {
      monitor.endTiming('total_join_time');
      monitor.logSummary();
    }
  };

  const trackFirebaseOperation = async <T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> => {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      FirebaseOpMonitor.logOperation(operation, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      FirebaseOpMonitor.logOperation(`${operation}_failed`, duration);
      throw error;
    }
  };

  return {
    monitor,
    trackJoinProcess,
    trackFirebaseOperation,
    ConnectionStateTracker,
    FirebaseOpMonitor
  };
};