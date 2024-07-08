import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface GrammarNode {
  name: string;
  children?: GrammarNode[];
  type?: string;
  fid?: number;
}

interface AbstractGrammar {
  name: string;
  startcat: string;
  funs: {
    [key: string]: {
      args: string[];
      cat: string;
    };
  };
}

interface Grammar {
  abstract: AbstractGrammar;
}

const ASTVis: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [filePath, setFilePath] = useState<string>('');
  const [grammar, setGrammar] = useState<Grammar | null>(null);
  const [abstractAST, setAbstractAST] = useState<GrammarNode | null>(null);

  const transformAbstractToTree = (grammar: Grammar): GrammarNode => {
    const startCat = grammar.abstract.startcat;

    const buildTree = (cat: string, visited: Set<string>): GrammarNode => {
      if (visited.has(cat)) {
        return { name: cat, children: [] };
      }

      visited.add(cat);
      const node: GrammarNode = { name: cat, children: [] };
      const funs = Object.entries(grammar.abstract.funs).filter(
        ([, funDetails]) => funDetails.cat === cat
      );

      funs.forEach(([funName, funDetails]) => {
        const funNode: GrammarNode = { name: funName, children: [], type: 'fun' };
        funDetails.args.forEach((arg: string) => {
          funNode.children?.push(buildTree(arg, new Set(visited)));
        });
        node.children?.push(funNode);
      });

      visited.delete(cat);
      return node;
    };

    return buildTree(startCat, new Set<string>());
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        setGrammar(json);
        setAbstractAST(transformAbstractToTree(json));
      } catch (error) {
        console.error('Error parsing JSON:', error);
      }
    }
  };

  const handlePathSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const json = await response.json();
      setGrammar(json);
      setAbstractAST(transformAbstractToTree(json));
    } catch (error) {
      console.error('Error fetching JSON:', error);
    }
  };

  const updateTree = (root: d3.HierarchyNode<GrammarNode>) => {
    if (!svgRef.current) return;

    const width = 1200;
    const height = 800;
    const margin = { top: 20, right: 120, bottom: 20, left: 120 };

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const treeLayout = d3.tree<GrammarNode>()
      .size([height - margin.top - margin.bottom, width - margin.left - margin.right]);

    const treeData = treeLayout(root);

    svg.selectAll('.link')
      .data(treeData.links())
      .enter().append('path')
      .attr('class', 'link')
      .attr('d', d3.linkHorizontal<d3.HierarchyPointLink<GrammarNode>, d3.HierarchyPointNode<GrammarNode>>()
        .x(d => d.y)
        .y(d => d.x)
      );

  const nodeGroup = svg.selectAll('.node')
    .data(treeData.descendants())
    .enter().append('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.y},${d.x})`)
    .on('click', (event: MouseEvent, d: d3.HierarchyNode<GrammarNode>) => handleNodeClick(event, d as d3.HierarchyPointNode<GrammarNode>));

    nodeGroup.append('circle')
      .attr('r', 4.5);

    nodeGroup.append('text')
      .attr('dy', '.31em')
      .attr('x', d => d.children ? -8 : 8)
      .style('text-anchor', d => d.children ? 'end' : 'start')
      .text(d => d.data.name);
  };

  const handleNodeClick = (event: MouseEvent, d: d3.HierarchyPointNode<GrammarNode>) => {
    if (d.data.type === 'fun' && d.children) {
      d.data.children = d.children.map(child => ({
        ...child.data,
        name: `Select ${child.data.name}`
      }));
      d.children = undefined;
    } else if (!d.children && d.data.type === 'fun' && d.data.children) {
      d.children = d.data.children.map(child => 
        d3.hierarchy({
          ...child,
          name: child.name.replace('Select ', '')
        })
      ) as d3.HierarchyPointNode<GrammarNode>[];
    }
    updateTree(d3.hierarchy(d.data));
  };

  useEffect(() => {
    if (abstractAST && svgRef.current) {
      const rootNode = d3.hierarchy(abstractAST);
      updateTree(rootNode);
    }
  }, [abstractAST]);

  return (
    <div>
      <div>
        <h2>Upload your grammar in a JSON format</h2>
        <input type="file" accept=".json" onChange={handleFileUpload} />
      </div>
      <div>
        <h2>Or state the path to your JSON grammar</h2>
        <h4>(or try the example foods grammar)</h4>
        <form onSubmit={handlePathSubmit}>
          <input
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            placeholder="https://raw.githubusercontent.com/Meowyam/treevis/main/examples/Foods.json"
          />
          <button type="submit">Load Grammar</button>
        </form>
      </div>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default ASTVis;