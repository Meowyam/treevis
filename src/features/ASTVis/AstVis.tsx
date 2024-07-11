import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { 
  Button, 
  Popover, 
  List, 
  ListItem, 
  ListItemButton,
  ListItemText, 
  Typography 
} from '@mui/material';

interface Production {
  type: string;
  fid: number;
  args: Arg[];
}

interface Arg {
type: string;
  hypos: any[];
  fid: number;
}

interface ConcreteFunction {
  name: string;
  lins: number[];
}

type Sequence = SymCat | SymKS | SymLit;

interface SymCat {
  type: 'SymCat';
  args: number[];
}

interface SymKS {
  type: 'SymKS';
  args: string[];
}

interface SymLit {
  type: 'SymLit';
  args: number[];
}

interface GrammarNode {
  name: string;
  children?: GrammarNode[];
  type: 'cat' | 'fun';
  funs?: string[];
  originalName?: string;
  concreteFunctions?: {
    [key: string]: string[];
  };
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

interface ConcreteGrammar {
  flags: {
    language: string;
  };

  productions: {
    [key: string]: Production[];
  };

  functions: ConcreteFunction[];

  sequences: Sequence[][];

  categories: {
    [key: string]: {
      start: number;
      end: number;
    };
  };

  totalfids: number;
}

interface Grammar {
  abstract: AbstractGrammar;
  concretes: {
    [key: string]: ConcreteGrammar;
  };
}

interface ConcreteFunctionWithLin extends ConcreteFunction {
  resolvedLins?: string[];
}

interface ConcreteGrammarWithLin extends ConcreteGrammar {
  functions: ConcreteFunctionWithLin[];
  resolvedSequences: string[];
}

interface GrammarWithLin extends Grammar {
  concretes: {
    [key: string]: ConcreteGrammarWithLin;
  };
}

const ASTVis: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [filePath, setFilePath] = useState<string>('');
  const [grammar, setGrammar] = useState<Grammar | null>(null);
  const [abstractAST, setAbstractAST] = useState<GrammarNode | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedNode, setSelectedNode] = useState<d3.HierarchyPointNode<GrammarNode> | null>(null);

  const [grammarMode, setGrammarMode] = useState<'abstract' | 'concrete'>('abstract');
  const [selectedConcrete, setSelectedConcrete] = useState<string | null>(null);

  const getConcreteLanguages = (): string[] => {
    if (!grammar || !grammar.concretes) return [];
    return Object.values(grammar.concretes).map(concrete => concrete.flags.language);
  };

  const transformAbstractToTree = (grammar: Grammar): GrammarNode => {
    const startCat = grammar.abstract.startcat;

    const buildTree = (cat: string, visited: Set<string>): GrammarNode => {
      if (visited.has(cat)) {
        return { name: cat, type: 'cat' };
      }
    
      visited.add(cat);
      const node: GrammarNode = { name: cat, children: [], type: 'cat' };
      
      const funs = Object.entries(grammar.abstract.funs)
        .filter(([, funDetails]) => funDetails.cat === cat)
        .map(([funName]) => funName);
      
      node.funs = funs;
    
      if (grammar.concretes) {
        node.concreteFunctions = {};
        Object.entries(grammar.concretes).forEach(([lang, concrete]) => {
          if (concrete.productions[cat]) {
            node.concreteFunctions![lang] = concrete.productions[cat]
              .map(prod => concrete.functions[prod.fid].name);
          }
        });
      }
    
      Object.values(grammar.abstract.funs)
        .filter(fun => fun.cat === cat)
        .forEach(fun => {
          fun.args.forEach(arg => {
            if (!node.children?.some(child => child.name === arg)) {
              node.children?.push(buildTree(arg, new Set(visited)));
            }
          });
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
        setGrammarMode('abstract');
        const concreteLanguages = Object.values(json.concretes).map((concrete) => (concrete as ConcreteGrammar).flags.language);
        console.log("concrete", concreteLanguages)
        if (concreteLanguages.length > 0) {
          setSelectedConcrete(concreteLanguages[0]);
        }
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
      setGrammarMode('abstract');
      const concreteLanguages = Object.values(json.concretes).map((concrete) => (concrete as ConcreteGrammar).flags.language);
      if (concreteLanguages.length > 0) {
        setSelectedConcrete(concreteLanguages[0]);
      }
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
      .attr('cursor', 'pointer')
      .on('click', handleNodeClick);

    nodeGroup.append('circle')
      .attr('r', 4.5);

    nodeGroup.append('text')
      .attr('dy', '.31em')
      .attr('x', d => d.children ? -8 : 8)
      .style('text-anchor', d => d.children ? 'end' : 'start')
      .text(d => {
        if (grammarMode === 'abstract') {
          return d.data.name;
        } else if (grammarMode === 'concrete' && selectedConcrete) {
          console.log("selectedConcrete", selectedConcrete)
          return d.data.concreteFunctions?.[selectedConcrete]?.[0] || d.data.name;
        }
        return d.data.name;
      });
  };

  const getOptionsForNode = (node: d3.HierarchyPointNode<GrammarNode>): string[] => {
    if (!grammar) return [];

    const category = node.data.name;

    if (grammarMode === 'abstract') {
      return Object.entries(grammar.abstract.funs)
        .filter(([, funDetails]) => funDetails.cat === category)
        .map(([funName]) => funName);
    } else if (selectedConcrete) {
        const concreteLang = Object.keys(grammar.concretes).find(
          key => grammar.concretes[key].flags.language === selectedConcrete
        );
        if (concreteLang) {
          const fixedConcreteLin = replaceLins(grammar) as GrammarWithLin;
          console.log("fixedlins", JSON.stringify(fixedConcreteLin, null, 2));
            const concrete = grammar.concretes[concreteLang];
            if (concrete.productions[category]) {
              return concrete.productions[category]
                .map(prod => concrete.functions[prod.fid].name);
          }
      }
    }

    return [];
};

  const handleNodeClick = (event: MouseEvent, d: d3.HierarchyPointNode<GrammarNode>) => {
    setSelectedNode(d);
    setAnchorEl(event.currentTarget as HTMLElement);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSelectedNode(null);
  };

  function parseLins(lins: number[], sequences: Sequence[][]): string {
    return lins.map(linIndex => {
      const sequence = sequences[linIndex];
      return sequence.map(seq => {
        if (seq.type === 'SymKS') {
          return seq.args[0];
        }
        if (seq.type === 'SymCat') {
          return `{${seq.args[1]}}`;
        }
        if (seq.type === 'SymLit') {
          return seq.args.join('');
        }
        return '';
      }).join(' ');
    }).join(' ');
  }
  
  function resolveSequence(sequence: Sequence[], cats: string[]): string {
    return sequence.map(seq => {
      if (seq.type === 'SymKS') {
        return seq.args[0];
      }
      if (seq.type === 'SymCat') {
        const catIndex = seq.args[0];
        return cats[catIndex] || `{${catIndex}}`;
      }
      if (seq.type === 'SymLit') {
        return `<${seq.args.join(',')}>`;
      }
      return '';
    }).join(' ');
  }
  
  function replaceLins(grammar: Grammar): GrammarWithLin {
    const resolvedGrammar: GrammarWithLin = {
      ...grammar,
      concretes: {}
    };
  
    const cats = new Set<string>();
    Object.values(grammar.abstract.funs).forEach(fun => {
      cats.add(fun.cat);
      fun.args.forEach(arg => cats.add(arg));
    });
    const catsArray = Array.from(cats);
  
    for (const [concreteName, concreteGrammar] of Object.entries(grammar.concretes)) {
      const resolvedFunctions: ConcreteFunctionWithLin[] = concreteGrammar.functions.map(func => ({
        ...func,
        resolvedLins: func.lins.map(linIndex => 
          resolveSequence(concreteGrammar.sequences[linIndex], catsArray)
        )
      }));
  
      resolvedGrammar.concretes[concreteName] = {
        ...concreteGrammar,
        functions: resolvedFunctions,
        resolvedSequences: concreteGrammar.sequences.map(seq => 
          resolveSequence(seq, catsArray)
        )
      };
    }
  
    return resolvedGrammar;
  }
  
  const handleFunctionSelect = (fun: string) => {
    if (selectedNode && grammar && selectedConcrete) {
      selectedNode.data.originalName = selectedNode.data.originalName || selectedNode.data.name;

      if (grammarMode === 'abstract') {
        selectedNode.data.name = fun;
      } else if (selectedConcrete && grammar.concretes[selectedConcrete]) {
        const concrete = grammar.concretes[selectedConcrete];
        const funIndex = concrete.functions.findIndex(f => f.name === fun);
        if (funIndex !== -1) {
          const lins = concrete.functions[funIndex].lins;
          const parsedLin = parseLins(lins, concrete.sequences);
          selectedNode.data.name = parsedLin;
        }
      }

      setAbstractAST({...abstractAST!});
      handleClose();
    }
  };

  const handleReset = () => {
    if (selectedNode && selectedNode.data.originalName) {
      selectedNode.data.name = selectedNode.data.originalName;
      setAbstractAST({...abstractAST!});
      handleClose();
    }
  };

  const open = Boolean(anchorEl);
  const id = open ? 'simple-popover' : undefined;

  useEffect(() => {
    if (abstractAST && svgRef.current) {
      const rootNode = d3.hierarchy(abstractAST);
      updateTree(rootNode);
    }
  }, [abstractAST, grammarMode, selectedConcrete]);

  return (
    <div>
      <div>
        <h2>Upload your grammar in a JSON format</h2>
        <h4>(<a href="https://github.com/GrammaticalFramework/gf-typescript">see instructions here on how to do it</a>)</h4>
        <input type="file" accept=".json" onChange={handleFileUpload} />
      </div>
      <div>
        <h2>Or state the path to your JSON grammar</h2>
        <h4>(<a href="https://raw.githubusercontent.com/Meowyam/treevis/main/examples/Foods.json">or try the example foods grammar</a>)</h4>
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

      {grammar && (
        <div>
          <Button 
            variant={grammarMode === 'abstract' ? 'contained' : 'outlined'}
            onClick={() => setGrammarMode('abstract')}
          >
            Abstract Grammar
          </Button>
          {getConcreteLanguages().map(lang => (
            <Button 
              key={lang}
              variant={grammarMode === 'concrete' && selectedConcrete === lang ? 'contained' : 'outlined'}
              onClick={() => {
                setGrammarMode('concrete');
                setSelectedConcrete(lang);
              }}
            >
              {lang}
            </Button>
          ))}
        </div>
      )}

      <svg ref={svgRef}></svg>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        <Typography sx={{ p: 2 }}>{selectedNode?.data.originalName || selectedNode?.data.name}</Typography>
        <List>
          {selectedNode && getOptionsForNode(selectedNode).map((option, index) => (
            <ListItem key={index} disablePadding>
              <ListItemButton onClick={() => handleFunctionSelect(option)}>
                <ListItemText 
                  primary={option} 
                  secondary={
                    grammarMode === 'concrete' && selectedConcrete && selectedNode.data.concreteFunctions?.[selectedConcrete]?.[index]
                  }
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        {selectedNode?.data.originalName && (
          <Button onClick={handleReset} fullWidth>Reset to {selectedNode.data.originalName}</Button>
        )}
      </Popover>
    </div>
  );
};

export default ASTVis;