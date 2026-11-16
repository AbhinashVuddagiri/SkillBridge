import React, { useEffect, useRef, useState } from 'react';
import { Network, Sparkles, User, Star, ArrowRight, Repeat } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function CompatibilityMapPage({ setCurrentView }) {
  const { setActiveProposalUser } = useAuth();
  const canvasRef = useRef(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGraph() {
      try {
        const res = await api.getNetworkGraph();
        if (res?.nodes) {
          setGraphData(res);
          setSelectedNode(res.nodes[0] || null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadGraph();
  }, []);

  // Canvas visual rendering with physics & pulse effects
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || graphData.nodes.length === 0) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let width = (canvas.width = canvas.parentElement.clientWidth);
    let height = (canvas.height = 550);

    // Initialize node coordinates in a circular layout
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.38;

    const nodesWithCoords = graphData.nodes.map((node, i) => {
      const angle = (i / graphData.nodes.length) * 2 * Math.PI;
      return {
        ...node,
        x: centerX + radius * Math.cos(angle) + (Math.random() - 0.5) * 20,
        y: centerY + radius * Math.sin(angle) + (Math.random() - 0.5) * 20,
        baseX: centerX + radius * Math.cos(angle),
        baseY: centerY + radius * Math.sin(angle),
        angle,
        radius: 24
      };
    });

    let time = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      time += 0.02;

      // Draw subtle circular orbit guides
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(22, 134, 106, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw connections/links
      graphData.links.forEach((link) => {
        const source = nodesWithCoords.find((n) => n.id === link.source);
        const target = nodesWithCoords.find((n) => n.id === link.target);

        if (source && target) {
          const isSelected =
            selectedNode && (source.id === selectedNode.id || target.id === selectedNode.id);

          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);

          if (isSelected) {
            ctx.strokeStyle = '#16866A';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([4, 4]);
          } else {
            ctx.strokeStyle = 'rgba(22, 134, 106, 0.25)';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([]);
          }
          ctx.stroke();
          ctx.setLineDash([]);

          // Animated particle traveling along connection line
          const progress = (time * 0.5 + (link.strength % 10)) % 1;
          const px = source.x + (target.x - source.x) * progress;
          const py = source.y + (target.y - source.y) * progress;

          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? '#16866A' : '#A8E6CF';
          ctx.fill();
        }
      });

      // Draw nodes
      nodesWithCoords.forEach((node) => {
        const isSelected = selectedNode?.id === node.id;

        // Subtle floating movement
        node.x = node.baseX + Math.sin(time + node.angle) * 8;
        node.y = node.baseY + Math.cos(time + node.angle) * 8;

        // Glow ring
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(168, 230, 207, 0.5)';
          ctx.fill();
        }

        // Node Circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#16866A' : '#FFFFFF';
        ctx.strokeStyle = isSelected ? '#A8E6CF' : '#D5E9DF';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.fill();
        ctx.stroke();

        // Node Label
        ctx.font = 'bold 11px Plus Jakarta Sans, sans-serif';
        ctx.fillStyle = '#164E41';
        ctx.textAlign = 'center';
        ctx.fillText(node.name.split(' ')[0], node.x, node.y + node.radius + 16);

        ctx.font = '9px Plus Jakarta Sans, sans-serif';
        ctx.fillStyle = '#16866A';
        ctx.fillText(node.topTeach, node.x, node.y + node.radius + 28);
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    // Click handler on canvas
    const handleCanvasClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      nodesWithCoords.forEach((node) => {
        const dist = Math.hypot(node.x - clickX, node.y - clickY);
        if (dist <= node.radius + 10) {
          setSelectedNode(node);
        }
      });
    };

    canvas.addEventListener('click', handleCanvasClick);

    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [graphData, selectedNode]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF] text-xs font-bold">
          <Network className="w-4 h-4 text-[#16866A]" />
          <span>Interactive Compatibility Network</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#164E41] tracking-tight">
          Skill Exchange Compatibility Map
        </h1>
        <p className="text-xs sm:text-sm text-[#527568] max-w-2xl leading-relaxed">
          Explore bidirectional learning relationships across the student ecosystem. Nodes represent active learners; lines represent mutual exchange potential. Click any node to inspect their details.
        </p>
      </div>

      {/* Main Layout: Canvas + Detail Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Interactive Canvas Area */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-4 sm:p-6 border border-[#D5E9DF] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-[#D5E9DF] text-xs text-[#527568]">
            <span className="flex items-center gap-1.5 font-semibold text-[#164E41]">
              <Sparkles className="w-4 h-4 text-[#16866A]" /> Live Network Graph
            </span>
            <span>Click any student node to highlight mutual connections</span>
          </div>

          <div className="relative w-full h-[550px]">
            <canvas ref={canvasRef} className="w-full h-full cursor-pointer" />
          </div>
        </div>

        {/* Selected Node Sidebar */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 sm:p-7 border border-[#D5E9DF] shadow-xs space-y-6">
          {selectedNode ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <img
                  src={
                    selectedNode.avatar ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedNode.name}`
                  }
                  alt={selectedNode.name}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-[#16866A]/30 shadow-sm"
                />
                <div>
                  <h3 className="text-base font-bold text-[#164E41]">{selectedNode.name}</h3>
                  <p className="text-xs text-[#527568]">{selectedNode.college}</p>
                  <div className="flex items-center gap-1 text-xs text-amber-500 mt-0.5 font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    <span>{selectedNode.rating || 5.0}</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F1FAF5] border border-[#D5E9DF] space-y-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-[#527568] uppercase tracking-wider block">
                    Key Skill Offered:
                  </span>
                  <span className="font-bold text-[#16866A]">{selectedNode.topTeach}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#527568] uppercase tracking-wider block">
                    Learning Goal:
                  </span>
                  <span className="font-bold text-[#164E41]">{selectedNode.topLearn}</span>
                </div>
              </div>

              {/* Connected Peers in Graph */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#164E41] uppercase tracking-wider block">
                  Compatible Matches in Network:
                </span>
                <div className="space-y-1.5">
                  {graphData.links
                    .filter(
                      (l) => l.source === selectedNode.id || l.target === selectedNode.id
                    )
                    .slice(0, 4)
                    .map((link, idx) => {
                      const otherId =
                        link.source === selectedNode.id ? link.target : link.source;
                      const otherNode = graphData.nodes.find((n) => n.id === otherId);
                      if (!otherNode) return null;
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedNode(otherNode)}
                          className="p-2.5 rounded-xl bg-[#F1FAF5] hover:bg-[#E4F6EE] border border-[#D5E9DF] cursor-pointer flex items-center justify-between text-xs transition-colors"
                        >
                          <span className="text-[#164E41] font-medium">{otherNode.name}</span>
                          <span className="text-[10px] font-bold text-[#16866A] px-2 py-0.5 rounded-full bg-[#E4F6EE] border border-[#D5E9DF]">
                            {link.strength}% Mutual
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => setCurrentView(`profile_${selectedNode.id}`)}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-[#164E41] bg-[#F1FAF5] border border-[#D5E9DF] hover:bg-[#E4F6EE] cursor-pointer transition-colors"
                >
                  View Full Profile
                </button>
                <button
                  onClick={async () => {
                    const fullUser = await api.getUser(selectedNode.id);
                    setActiveProposalUser(fullUser.user);
                  }}
                  className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md shadow-[#16866A]/20 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Propose Exchange</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-[#527568]">
              Click any node on the graph to view student exchange details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
