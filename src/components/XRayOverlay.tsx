import React, { useEffect, useState, useRef } from 'react';
import { useSimulator } from '../store/simulatorStore';

interface StreamItem {
  id: string;
  left: number;
  top: number;
  speed: number;
  text: string;
}

const TEMPLATES = [
  '{"kind":"Pod","apiVersion":"v1","metadata":{"name":"api-server"}}',
  'POST /api/v1/namespaces/default/pods HTTP/1.1',
  '{"type":"ADDED","object":{"kind":"Endpoints"}}',
  '[etcd] raft.node: 7f33... elected leader',
  '{"level":"info","msg":"Sync loop finished"}',
  'GET /apis/apps/v1/deployments?watch=true',
  '{"kind":"ReplicaSet","spec":{"replicas":3}}',
  '{"status":"Running","podIP":"10.244.1.5"}',
  '> WATCH /api/v1/services',
  '{"msg":"Scheduling pod default/my-app-pod"}'
];

export function XRayOverlay() {
  const { xrayMode } = useSimulator();
  const [items, setItems] = useState<StreamItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!xrayMode) {
      setItems([]);
      return;
    }

    const generateItem = () => {
      if (!containerRef.current) return;
      const id = Math.random().toString(36).substr(2, 9);
      const text = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
      
      const item: StreamItem = {
        id,
        left: Math.random() * 90,
        top: -5,
        speed: 1 + Math.random() * 2,
        text
      };

      setItems(prev => {
        const next = [...prev, item];
        if (next.length > 30) return next.slice(next.length - 30);
        return next;
      });
    };

    const spawnInterval = setInterval(generateItem, 400);
    return () => clearInterval(spawnInterval);
  }, [xrayMode]);

  useEffect(() => {
    if (!xrayMode) return;
    
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (time: number) => {
      const delta = (time - lastTime) / 16; // normalize to 60fps
      lastTime = time;

      setItems(prev => prev.map(item => ({
        ...item,
        top: item.top + (item.speed * delta)
      })).filter(item => item.top < 110));

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [xrayMode]);

  if (!xrayMode) return null;

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 50, // above mostly everything except modals
        overflow: 'hidden',
        background: 'rgba(5, 10, 20, 0.4)', // darken the screen slightly
      }}
    >
      {items.map(item => (
        <div
          key={item.id}
          style={{
            position: 'absolute',
            left: `${item.left}%`,
            top: `${item.top}%`,
            color: 'var(--k8s-green)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            opacity: 0.6,
            textShadow: '0 0 5px var(--k8s-green)',
            whiteSpace: 'nowrap'
          }}
        >
          {item.text}
        </div>
      ))}
    </div>
  );
}
