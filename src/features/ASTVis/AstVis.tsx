import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as d3 from 'd3';
import { selectAST, setAST } from './astVisSlice';

interface GrammarNode {
  name: string;
  children?: GrammarNode[];
  isArrow?: boolean;
}

const ASTVis: React.FC = () => {
  const dispatch = useDispatch();
  const ast = useSelector(selectAST);
  const svgRef = useRef<SVGSVGElement>(null);
  const [filePath, setFilePath] = useState<string>('');

  const transformGrammarToTree = (grammar: any): GrammarNode => {
    const root: GrammarNode = { name: grammar.abstract.name, children: [] };
  
    Object.entries(grammar.abstract.funs).forEach(([funName, funDetails]: [string, any]) => {
      const funNode: GrammarNode = { name: funName, children: [] };
      const catNode: GrammarNode = { name: funDetails.cat, children: [] };
      funNode.children?.push(catNode);
      
      if (funDetails.args.length > 0) {
        const arrowNode: GrammarNode = { name: '', isArrow: true, children: [] };
        catNode.children?.push(arrowNode);
        
        funDetails.args.forEach((arg: string) => {
          arrowNode.children?.push({ name: arg });
        });
      }
      
      root.children?.push(funNode);
    });
  
    return root;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          const treeData = transformGrammarToTree(json);
          dispatch(setAST(treeData));
        } catch (error) {
          console.error('error: ', error);
        }
      };
      reader.readAsText(file);
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
      const treeData = transformGrammarToTree(json);
      dispatch(setAST(treeData));
    } catch (error) {
      console.error('error: ', error);
    }
  };

  useEffect(() => {
    if (ast && svgRef.current) {
      const width = 1200;
      const height = 800;
      const margin = { top: 20, right: 120, bottom: 20, left: 120 };

      d3.select(svgRef.current).selectAll('*').remove();

      const svg = d3.select(svgRef.current)
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const root = d3.hierarchy(ast);

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

      const node = svg.selectAll('.node')
        .data(treeData.descendants())
        .enter().append('g')
        .attr('class', 'node')
        .attr('transform', d => `translate(${d.y},${d.x})`);

        node.append('circle')
        .attr('r', d => d.data.isArrow ? 0 : 4.5);

      node.append('text')
        .attr('dy', '.31em')
        .attr('x', d => d.children ? -8 : 8)
        .style('text-anchor', d => d.children ? 'end' : 'start')
        .text(d => d.data.name);
    }
  }, [ast]);


  return (
    <div>
      <div>
        <h2>upload your grammar in a json format</h2>
        <h4>see <a href="https://github.com/GrammaticalFramework/gf-typescript">here for instructions</a></h4>
        <input type="file" accept=".json" onChange={handleFileUpload} />
      </div>
      <div>
        <h2>or state the path to your json grammar</h2>
        <h4>or try the example foods grammar:</h4>
        <form onSubmit={handlePathSubmit}>
          <input 
            type="text" 
            value={filePath} 
            onChange={(e) => setFilePath(e.target.value)} 
            placeholder="https://raw.githubusercontent.com/Meowyam/treevis/main/examples/Foods.json"
          />
          <button type="submit">load grammar</button>
        </form>
      </div>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default ASTVis;