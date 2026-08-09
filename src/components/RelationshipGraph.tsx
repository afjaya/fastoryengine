import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Network, Search, RotateCcw, User, Shield, Info, Heart, Users, Edit3 } from 'lucide-react';
import { Character } from '../types.js';
import { useLanguage } from './LanguageContext.js';

interface RelationshipGraphProps {
  characters: Character[];
  onEdit?: (character: Character) => void;
}

interface Node {
  id: string;
  name: string;
  status: 'Alive' | 'Dead';
  occupation: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Link {
  id: string;
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  type: string;
}

export const RelationshipGraph: React.FC<RelationshipGraphProps> = ({ characters, onEdit }) => {
  const { t, language } = useLanguage();
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [hoveredCharId, setHoveredCharId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const canvasRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const [dimensions, setDimensions] = useState({ width: 700, height: 480 });
  const [nodes, setNodes] = useState<Node[]>([]);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  // Resize handler
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        // Keep a neat aspect ratio
        setDimensions({
          width: Math.max(width, 500),
          height: 480
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Parse links from character relationship fields
  const links = useMemo<Link[]>(() => {
    const results: Link[] = [];
    const seen = new Set<string>();

    characters.forEach(charA => {
      if (!charA.relationships) return;

      // Check for mentions of other character names
      characters.forEach(charB => {
        if (charA.id === charB.id) return;

        const nameLower = charB.name.toLowerCase();
        const relsLower = charA.relationships.toLowerCase();

        if (relsLower.includes(nameLower)) {
          // Found relationship reference. Let's parse details.
          // Split by typical clause dividers
          const clauses = charA.relationships.split(/[,;\n]/);
          let type = language === 'ID' ? 'Berhubungan' : 'Related';

          for (const clause of clauses) {
            if (clause.toLowerCase().includes(nameLower)) {
              // Extract text that isn't the name
              let desc = clause.replace(new RegExp(charB.name, 'gi'), '').trim();
              // Strip brackets, parenthesis, dashes
              desc = desc.replace(/[()\[\]\-]/g, '').trim();
              // Clean up prepositions
              desc = desc.replace(/^(?:of|with|to|is|a)\s+/i, '').trim();
              
              if (desc) {
                // Capitalize first letter
                type = desc.charAt(0).toUpperCase() + desc.slice(1);
              }
              break;
            }
          }

          // Avoid duplicate lines in undirected visualization, but record directed links
          const key = `${charA.id}-${charB.id}`;
          const reverseKey = `${charB.id}-${charA.id}`;
          
          if (!seen.has(key)) {
            results.push({
              id: key,
              sourceId: charA.id,
              targetId: charB.id,
              sourceName: charA.name,
              targetName: charB.name,
              type
            });
            seen.add(key);
          }
        }
      });
    });

    return results;
  }, [characters, language]);

  // Selected Character Details
  const selectedChar = useMemo(() => {
    return characters.find(c => c.id === selectedCharId) || null;
  }, [characters, selectedCharId]);

  // Initializing nodes and running physics simulation
  useEffect(() => {
    if (characters.length === 0) {
      setNodes([]);
      return;
    }

    const { width, height } = dimensions;
    const cx = width / 2;
    const cy = height / 2;

    // Preserve existing node positions if they exist to avoid resetting on simple character edits
    setNodes(prev => {
      return characters.map((c, i) => {
        const existing = prev.find(p => p.id === c.id);
        if (existing) {
          // Keep position, but update status/name/occupation
          return {
            ...existing,
            name: c.name,
            status: c.status,
            occupation: c.occupation
          };
        }

        // Otherwise layout in a beautiful circle
        const angle = (i / characters.length) * 2 * Math.PI;
        const radius = Math.min(width, height) * 0.35;
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          occupation: c.occupation,
          x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 20,
          y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 20,
          vx: 0,
          vy: 0
        };
      });
    });
  }, [characters, dimensions.width, dimensions.height]);

  // Physics update loop
  useEffect(() => {
    if (nodes.length === 0) return;

    let animationFrameId: number;
    const width = dimensions.width;
    const height = dimensions.height;
    const cx = width / 2;
    const cy = height / 2;

    const tick = () => {
      setNodes(currentNodes => {
        // Create working copy
        const next = currentNodes.map(node => ({ ...node }));
        
        const kRepulsion = 1200;
        const kAttraction = 0.05;
        const restLength = 130;
        const kGravity = 0.025;
        const rBound = 25; // padding boundary

        // 1. Repulsion between all nodes
        for (let i = 0; i < next.length; i++) {
          const u = next[i];
          for (let j = i + 1; j < next.length; j++) {
            const v = next[j];
            const dx = u.x - v.x;
            const dy = u.y - v.y;
            const distSq = dx * dx + dy * dy + 0.1;
            const dist = Math.sqrt(distSq);
            
            if (dist < 250) {
              const force = kRepulsion / distSq;
              const fX = (dx / dist) * force;
              const fY = (dy / dist) * force;
              
              if (dragRef.current?.id !== u.id) {
                u.vx += fX;
                u.vy += fY;
              }
              if (dragRef.current?.id !== v.id) {
                v.vx -= fX;
                v.vy -= fY;
              }
            }
          }
        }

        // 2. Attraction along links
        links.forEach(link => {
          const uIndex = next.findIndex(n => n.id === link.sourceId);
          const vIndex = next.findIndex(n => n.id === link.targetId);
          if (uIndex === -1 || vIndex === -1) return;
          
          const u = next[uIndex];
          const v = next[vIndex];
          
          const dx = u.x - v.x;
          const dy = u.y - v.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          
          // Hooke's Law: F = -k * (x - d)
          const force = kAttraction * (dist - restLength);
          const fX = (dx / dist) * force;
          const fY = (dy / dist) * force;

          if (dragRef.current?.id !== u.id) {
            u.vx -= fX;
            u.vy -= fY;
          }
          if (dragRef.current?.id !== v.id) {
            v.vx += fX;
            v.vy += fY;
          }
        });

        // 3. Gravity/Center attraction and boundary damping
        next.forEach(node => {
          if (dragRef.current?.id === node.id) return;

          // Pull to center
          node.vx -= (node.x - cx) * kGravity;
          node.vy -= (node.y - cy) * kGravity;

          // Apply physics
          node.vx *= 0.8;
          node.vy *= 0.8;
          node.x += node.vx;
          node.y += node.vy;

          // Constrain within viewBox
          node.x = Math.max(rBound, Math.min(width - rBound, node.x));
          node.y = Math.max(rBound, Math.min(height - rBound, node.y));
        });

        return next;
      });

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [links, dimensions.width, dimensions.height]);

  const handleResetSimulation = () => {
    const { width, height } = dimensions;
    const cx = width / 2;
    const cy = height / 2;

    setNodes(characters.map((c, i) => {
      const angle = (i / characters.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.35;
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        occupation: c.occupation,
        x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 10,
        y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 10,
        vx: 0,
        vy: 0
      };
    }));
  };

  // Node Drag Handlers
  const handleNodeMouseDown = (e: React.MouseEvent<SVGElement>, nodeId: string) => {
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Store drag offset relative to dimensions inside the viewbox SVG
    const svgWidth = dimensions.width;
    const svgHeight = dimensions.height;
    const viewboxX = (mouseX / rect.width) * svgWidth;
    const viewboxY = (mouseY / rect.height) * svgHeight;

    dragRef.current = {
      id: nodeId,
      offsetX: viewboxX - node.x,
      offsetY: viewboxY - node.y
    };

    setSelectedCharId(nodeId);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragRef.current || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const svgWidth = dimensions.width;
    const svgHeight = dimensions.height;
    const viewboxX = (mouseX / rect.width) * svgWidth;
    const viewboxY = (mouseY / rect.height) * svgHeight;

    const targetX = viewboxX - dragRef.current.offsetX;
    const targetY = viewboxY - dragRef.current.offsetY;

    setNodes(currentNodes =>
      currentNodes.map(node =>
        node.id === dragRef.current?.id
          ? { ...node, x: targetX, y: targetY, vx: 0, vy: 0 }
          : node
      )
    );
  };

  const handleMouseUp = () => {
    dragRef.current = null;
  };

  // Touch support for mobile devices
  const handleNodeTouchStart = (e: React.TouchEvent<SVGElement>, nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !canvasRef.current || e.touches.length === 0) return;

    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = touch.clientX - rect.left;
    const mouseY = touch.clientY - rect.top;

    const svgWidth = dimensions.width;
    const svgHeight = dimensions.height;
    const viewboxX = (mouseX / rect.width) * svgWidth;
    const viewboxY = (mouseY / rect.height) * svgHeight;

    dragRef.current = {
      id: nodeId,
      offsetX: viewboxX - node.x,
      offsetY: viewboxY - node.y
    };

    setSelectedCharId(nodeId);
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!dragRef.current || !canvasRef.current || e.touches.length === 0) return;

    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = touch.clientX - rect.left;
    const mouseY = touch.clientY - rect.top;

    const svgWidth = dimensions.width;
    const svgHeight = dimensions.height;
    const viewboxX = (mouseX / rect.width) * svgWidth;
    const viewboxY = (mouseY / rect.height) * svgHeight;

    const targetX = viewboxX - dragRef.current.offsetX;
    const targetY = viewboxY - dragRef.current.offsetY;

    setNodes(currentNodes =>
      currentNodes.map(node =>
        node.id === dragRef.current?.id
          ? { ...node, x: targetX, y: targetY, vx: 0, vy: 0 }
          : node
      )
    );
  };

  // Filters
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const q = searchQuery.toLowerCase();
    return nodes.filter(n => n.name.toLowerCase().includes(q));
  }, [nodes, searchQuery]);

  const isFiltered = (nodeId: string) => {
    if (!searchQuery.trim()) return true;
    return nodeId === selectedCharId || nodes.find(n => n.id === nodeId)?.name.toLowerCase().includes(searchQuery.toLowerCase());
  };

  // Find relationships for the selected character
  const selectedCharacterRels = useMemo(() => {
    if (!selectedCharId) return [];
    return links.filter(l => l.sourceId === selectedCharId || l.targetId === selectedCharId);
  }, [links, selectedCharId]);

  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg flex flex-col" id="character-relationship-graph-container">
      {/* Header Bar */}
      <div className="border-b border-zinc-800 bg-zinc-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Network className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5" id="graph-header-title">
              {t('relationshipNetwork')}
              <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded tracking-wide font-mono">
                {links.length} {language === 'ID' ? 'KONEKSI' : 'LINKS'}
              </span>
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {t('relationshipNetworkDesc')}
            </p>
          </div>
        </div>
        
        {/* Actions bar */}
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-zinc-300 placeholder-zinc-600 rounded px-8 py-1.5 text-xs w-full sm:w-44 focus:outline-none focus:border-indigo-500 transition-colors"
              id="graph-search-input"
            />
          </div>

          {/* Reset button */}
          <button
            onClick={handleResetSimulation}
            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded transition-all cursor-pointer"
            title={t('resetGraph')}
            id="graph-reset-btn"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {characters.length === 0 ? (
        <div className="py-24 text-center bg-zinc-950/25 flex flex-col items-center justify-center p-4">
          <Network className="w-12 h-12 text-zinc-800 mb-3 animate-pulse" />
          <p className="text-sm font-semibold text-zinc-400">{t('noCharacters')}</p>
          <p className="text-xs text-zinc-500 max-w-sm mt-1">
            {language === 'ID' 
              ? 'Tambahkan karakter di tab database di bawah ini untuk melihat jaringan hubungan mereka secara interaktif!'
              : 'Add characters in the database tab below to view their relationship network interactively!'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row h-[500px]" ref={containerRef}>
          {/* SVG Workspace */}
          <div className="flex-1 relative bg-zinc-950 overflow-hidden cursor-grab active:cursor-grabbing border-b lg:border-b-0 lg:border-r border-zinc-800">
            {/* Grid dot indicator backdrop */}
            <svg
              ref={canvasRef}
              width={dimensions.width}
              height={dimensions.height}
              viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
              className="w-full h-full block"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
              id="relationship-svg-canvas"
            >
              <defs>
                {/* Dot background pattern */}
                <pattern id="dot-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="0.8" fill="#3f3f46" opacity="0.4" />
                </pattern>
                
                {/* Arrowhead marker definition */}
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M0,1 L10,5 L0,9 Z" fill="#4f46e5" />
                </marker>
                
                {/* Arrowhead marker for selected states */}
                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M0,1 L10,5 L0,9 Z" fill="#818cf8" />
                </marker>
              </defs>

              {/* Grid Background */}
              <rect width="100%" height="100%" fill="url(#dot-grid)" />

              {/* DRAW CONNECTIONS (Links) */}
              <g id="graph-links-group">
                {links.map((link) => {
                  const sourceNode = nodes.find(n => n.id === link.sourceId);
                  const targetNode = nodes.find(n => n.id === link.targetId);
                  if (!sourceNode || !targetNode) return null;

                  // Highlight logic
                  const isSelectedPath = selectedCharId === link.sourceId || selectedCharId === link.targetId;
                  const isHoveredPath = hoveredCharId === link.sourceId || hoveredCharId === link.targetId;
                  const isFilteredOut = searchQuery && (!isFiltered(link.sourceId) || !isFiltered(link.targetId));

                  let strokeColor = '#27272a'; // neutral default
                  let strokeWidth = 1.5;
                  let opacity = 0.6;
                  
                  if (isSelectedPath || isHoveredPath) {
                    strokeColor = '#818cf8'; // active link color
                    strokeWidth = 2.5;
                    opacity = 0.95;
                  } else if (isFilteredOut) {
                    opacity = 0.15;
                  }

                  // Precise trimming to draw lines precisely from node borders
                  const dx = targetNode.x - sourceNode.x;
                  const dy = targetNode.y - sourceNode.y;
                  const len = Math.sqrt(dx * dx + dy * dy) || 0.1;
                  
                  const rSource = 20; // source radius
                  const rTarget = 20 + 8; // target radius + space for arrow

                  if (len < rSource + rTarget) return null; // Avoid drawing too short lines

                  const x1 = sourceNode.x + (dx / len) * rSource;
                  const y1 = sourceNode.y + (dy / len) * rSource;
                  const x2 = targetNode.x - (dx / len) * rTarget;
                  const y2 = targetNode.y - (dy / len) * rTarget;

                  // Midpoint for relationship label
                  const mx = (x1 + x2) / 2;
                  const my = (y1 + y2) / 2;

                  return (
                    <g key={link.id} className="transition-all duration-300">
                      {/* Connection Line */}
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeOpacity={opacity}
                        markerEnd={`url(#${isSelectedPath ? 'arrow-active' : 'arrow'})`}
                        className="transition-all duration-200"
                      />

                      {/* Connection Label (Only if hovered/selected, or always if small count) */}
                      {(isSelectedPath || isHoveredPath || links.length < 15) && !isFilteredOut && (
                        <g transform={`translate(${mx}, ${my})`}>
                          <rect
                            x={-Math.min(50, link.type.length * 3.5 + 8)}
                            y={-8}
                            width={Math.min(100, link.type.length * 7 + 16)}
                            height={16}
                            rx={4}
                            fill="#09090b"
                            stroke={isSelectedPath ? '#4f46e5' : '#27272a'}
                            strokeWidth={1}
                            className="transition-all"
                          />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="text-[9px] font-bold text-zinc-300 font-sans tracking-wide fill-current"
                          >
                            {link.type}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* DRAW CHARACTERS (Nodes) */}
              <g id="graph-nodes-group">
                {nodes.map((node) => {
                  const isSelected = selectedCharId === node.id;
                  const isHovered = hoveredCharId === node.id;
                  const isNodeFiltered = isFiltered(node.id);
                  const isFilteredOut = searchQuery && !isNodeFiltered;

                  // Node color configurations
                  const isDead = node.status === 'Dead';
                  const statusColor = isDead 
                    ? { bg: '#3f1115', border: '#ef4444', text: '#fca5a5' }
                    : { bg: '#064e3b', border: '#10b981', text: '#a7f3d0' };

                  const borderStroke = isSelected 
                    ? '#6366f1' 
                    : isHovered 
                      ? '#818cf8' 
                      : statusColor.border;

                  const fillBg = isSelected 
                    ? '#312e81' 
                    : isHovered 
                      ? '#1e1b4b' 
                      : statusColor.bg;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      className="transition-all duration-75 select-none"
                      onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                      onTouchStart={(e) => handleNodeTouchStart(e, node.id)}
                      onMouseEnter={() => setHoveredCharId(node.id)}
                      onMouseLeave={() => setHoveredCharId(null)}
                      onClick={() => setSelectedCharId(node.id)}
                      style={{ opacity: isFilteredOut ? 0.2 : 1 }}
                    >
                      {/* Interactive Touch/Click Target (Enlarged background) */}
                      <circle r={28} fill="transparent" className="cursor-pointer" />

                      {/* Outer Glow for Selected states */}
                      {(isSelected || isHovered) && (
                        <circle
                          r={24}
                          fill="none"
                          stroke={isSelected ? '#6366f1' : '#4f46e5'}
                          strokeWidth={2}
                          strokeDasharray="4 2"
                          className="animate-[spin_20s_linear_infinite]"
                        />
                      )}

                      {/* Core Node Circle */}
                      <circle
                        r={20}
                        fill={fillBg}
                        stroke={borderStroke}
                        strokeWidth={isSelected ? 3 : 2}
                        className="cursor-pointer transition-all duration-150 shadow-md"
                      />

                      {/* Character Initials Badge */}
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="text-[10px] font-bold text-zinc-100 font-mono fill-current pointer-events-none"
                        y={-1}
                      >
                        {node.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}
                      </text>

                      {/* Character Name Float Label */}
                      <g transform="translate(0, 32)" className="pointer-events-none">
                        {/* Semi-transparent text background for absolute readability */}
                        <rect
                          x={-Math.min(60, node.name.length * 3.8 + 6)}
                          y={-8}
                          width={Math.min(120, node.name.length * 7.6 + 12)}
                          height={16}
                          rx={3}
                          fill="#09090b"
                          fillOpacity={0.8}
                          stroke={isSelected ? '#4f46e5' : 'transparent'}
                          strokeWidth={1}
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          className={`text-[9px] font-bold tracking-wide font-sans ${
                            isSelected 
                              ? 'text-indigo-400 font-semibold' 
                              : isDead 
                                ? 'text-rose-400' 
                                : 'text-zinc-200'
                          } fill-current`}
                        >
                          {node.name}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Instruction Banner overlay */}
            <div className="absolute bottom-3 left-3 bg-zinc-950/85 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-800 pointer-events-none text-[10px] text-zinc-400 font-mono">
              💡 {language === 'ID' ? 'Seret simpul untuk mengatur ulang layout' : 'Drag nodes to rearrange layout'}
            </div>
          </div>

          {/* SIDE PANEL Inspector (Selected node statistics & links list) */}
          <div className="w-full lg:w-72 bg-zinc-900/40 flex flex-col justify-between overflow-y-auto" id="graph-inspector-panel">
            {selectedChar ? (
              <div className="p-4 space-y-4 flex-1 flex flex-col justify-between h-full">
                <div className="space-y-4">
                  {/* Selected Character Header */}
                  <div className="border-b border-zinc-850 pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider font-mono">{t('statusActive')}</h3>
                        <h4 className="text-sm font-bold text-zinc-100 mt-1 flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${selectedChar.status === 'Dead' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                          {selectedChar.name}
                        </h4>
                      </div>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                        selectedChar.status === 'Alive' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {selectedChar.status === 'Alive' ? t('alive') : t('dead')}
                      </span>
                    </div>
                  </div>

                  {/* Metadata Stats */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400 bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/60 font-mono">
                    <div>
                      AGE: <span className="text-zinc-200 font-semibold">{selectedChar.age || 'N/A'}</span>
                    </div>
                    <div>
                      GENDER: <span className="text-zinc-200 font-semibold">{selectedChar.gender || 'N/A'}</span>
                    </div>
                    <div className="col-span-2 mt-1 truncate">
                      JOB: <span className="text-zinc-200 font-semibold">{selectedChar.occupation || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Character biography excerpt */}
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block font-mono flex items-center gap-1">
                      <Info className="w-3 h-3 text-zinc-500" />
                      {language === 'ID' ? 'BIOGRAFI SINGKAT' : 'BIOGRAPHY EXCEPT'}
                    </span>
                    <p className="text-xs text-zinc-300 leading-relaxed max-h-24 overflow-y-auto pr-1">
                      {selectedChar.biography || (language === 'ID' ? 'Belum disediakan.' : 'None provided.')}
                    </p>
                  </div>

                  {/* Direct connection links list */}
                  <div className="space-y-1.5 border-t border-zinc-850 pt-3">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block font-mono flex items-center gap-1">
                      <Users className="w-3 h-3 text-indigo-400" />
                      {t('relatedCharacters')} ({selectedCharacterRels.length})
                    </span>
                    
                    {selectedCharacterRels.length === 0 ? (
                      <p className="text-[11px] text-zinc-500 italic mt-1">
                        {language === 'ID' ? 'Tidak ada hubungan yang tercatat.' : 'No active connections recorded.'}
                      </p>
                    ) : (
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {selectedCharacterRels.map(rel => {
                          const targetId = rel.sourceId === selectedCharId ? rel.targetId : rel.sourceId;
                          const targetNode = characters.find(c => c.id === targetId);
                          
                          return (
                            <button
                              key={rel.id}
                              onClick={() => setSelectedCharId(targetId)}
                              className="w-full text-left bg-zinc-950/40 hover:bg-zinc-950 border border-zinc-850/60 hover:border-zinc-800 p-2 rounded text-xs flex items-center justify-between text-zinc-300 transition-all cursor-pointer group"
                            >
                              <span className="font-semibold group-hover:text-indigo-400 transition-colors">
                                {targetNode?.name}
                              </span>
                              <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded uppercase tracking-wide text-right font-mono max-w-[120px] truncate">
                                {rel.type}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer instructions inside side panel */}
                <div className="mt-4 pt-3 border-t border-zinc-850 text-[10px] text-zinc-500 leading-normal flex flex-col gap-2">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(selectedChar)}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-1.5 rounded text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-950/20 active:scale-98"
                      id="graph-edit-profile-btn"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {language === 'ID' ? 'Ubah Profil' : 'Edit Profile'}
                    </button>
                  )}
                  <div className="flex items-start gap-1">
                    <User className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                    <span>
                      {language === 'ID' 
                        ? 'Gunakan database karakter untuk mengedit profil ini secara mendalam' 
                        : 'Use character database below to edit details or add new connections'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 h-full flex flex-col items-center justify-center text-center text-zinc-500 space-y-3">
                <Network className="w-8 h-8 text-zinc-700 animate-pulse" />
                <div>
                  <p className="text-xs font-semibold text-zinc-400">{language === 'ID' ? 'Pilih Karakter' : 'Select a Character'}</p>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                    {language === 'ID'
                      ? 'Klik pada simpul karakter apa saja di dalam grafik untuk memeriksa profil detail dan melihat jaringan hubungan mereka!'
                      : 'Click on any character node in the graph workspace to inspect their profiles and trace specific storylines!'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
