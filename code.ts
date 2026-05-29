// 将选中的 Frames 和 Components 转换为 Images 并保留原容器，然后随机更换位置

// 定义可处理的节点类型
type ProcessableNode = FrameNode | ComponentNode;

// 将 Frame 或 Component 转换为图像的函数
async function convertToImages(nodes: ProcessableNode[]): Promise<ProcessableNode[]> {
  // 创建一个数组来存储处理过的节点
  const processedNodes: ProcessableNode[] = [];

  // 处理每个选中的节点
  for (const node of nodes) {
    try {
      // 导出节点为图像
      const bytes = await node.exportAsync({
        format: 'PNG',
        constraint: { type: 'SCALE', value: 1 }
      });

      // 创建一个新的图像节点
      const image = figma.createImage(bytes);
      
      // 创建一个矩形节点来显示图像
      const rect = figma.createRectangle();
      
      // 设置矩形的大小与原节点相同
      rect.resize(node.width, node.height);
      
      // 设置填充为图像
      rect.fills = [{
        type: 'IMAGE',
        imageHash: image.hash,
        scaleMode: 'FILL'
      }];
      
      // 设置矩形的名称
      rect.name = 'Image';
      
      // 移除节点中的所有子节点
      while (node.children.length > 0) {
        node.children[0].remove();
      }
      
      // 将矩形添加到节点中
      node.appendChild(rect);
      
      // 将处理过的节点添加到数组中
      processedNodes.push(node);
      
    } catch (error) {
      console.error(`处理 ${node.type} "${node.name}" 时出错:`, error);
      figma.notify(`处理 ${node.type} "${node.name}" 时出错`);
    }
  }

  return processedNodes;
}

// 获取节点的完整路径，用于确定层级结构
function getNodePath(node: BaseNode): string {
  let path = '';
  let current: BaseNode | null = node;
  
  while (current && current.type !== 'PAGE') {
    path = current.type + '/' + path;
    current = current.parent;
  }
  
  return path;
}

// 随机更换节点位置的函数 - 考虑层级结构
function randomizePositions(nodes: ProcessableNode[]): void {
  if (nodes.length <= 1) return; // 如果只有一个或没有节点，不需要更换位置
  
  // 按父节点和层级结构分组
  const nodesByParentType = new Map<string, ProcessableNode[]>();
  
  // 将节点按照父节点类型和层级结构分组
  nodes.forEach(node => {
    // 获取父节点类型和层级结构
    const parentType = node.parent ? node.parent.type : 'null';
    const nodePath = getNodePath(node);
    const groupKey = `${parentType}:${nodePath}`;
    
    if (!nodesByParentType.has(groupKey)) {
      nodesByParentType.set(groupKey, []);
    }
    nodesByParentType.get(groupKey)?.push(node);
  });
  
  // 记录处理的节点总数
  let totalProcessedNodes = 0;
  
  // 对每个分组内的节点分别进行位置随机化
  nodesByParentType.forEach((nodesGroup, groupKey) => {
    // 如果该分组下只有一个节点，不需要交换位置
    if (nodesGroup.length <= 1) {
      figma.notify(`分组 "${groupKey}" 中只有 ${nodesGroup.length} 个节点，不需要交换位置`);
      return;
    }
    
    // 收集该组内所有节点的原始位置
    const originalPositions: {x: number, y: number}[] = nodesGroup.map(node => ({
      x: node.x,
      y: node.y
    }));
    
    // 创建一个打乱的位置数组
    const shuffledPositions = [...originalPositions];
    
    // Fisher-Yates 洗牌算法
    for (let i = shuffledPositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPositions[i], shuffledPositions[j]] = [shuffledPositions[j], shuffledPositions[i]];
    }
    
    // 将打乱后的位置应用到该组的节点
    nodesGroup.forEach((node, index) => {
      node.x = shuffledPositions[index].x;
      node.y = shuffledPositions[index].y;
    });
    
    // 更新处理的节点总数
    totalProcessedNodes += nodesGroup.length;
    
    // 通知用户
    figma.notify(`已随机调换 ${nodesGroup.length} 个同级节点的位置（在 ${groupKey} 中）`);
  });
  
  // 通知用户总体情况
  if (totalProcessedNodes > 0) {
    figma.notify(`总共随机调换了 ${totalProcessedNodes} 个节点的位置`);
  } else {
    figma.notify('没有可以调换位置的节点组');
  }
}

// 主函数
async function main() {
  // 检查是否有选中的节点
  if (figma.currentPage.selection.length === 0) {
    figma.notify('请选择至少一个 Frame 或 Component');
    figma.closePlugin();
    return;
  }

  // 过滤出所有 Frame 和 Component 类型的节点
  const selectedNodes = figma.currentPage.selection.filter(
    node => node.type === 'FRAME' || node.type === 'COMPONENT'
  ) as ProcessableNode[];

  if (selectedNodes.length === 0) {
    figma.notify('请选择至少一个 Frame 或 Component');
    figma.closePlugin();
    return;
  }

  figma.notify(`正在处理 ${selectedNodes.length} 个节点...`);

  // 第一步：将节点转换为图像
  const processedNodes = await convertToImages(selectedNodes);
  
  // 第二步：随机更换节点位置（考虑层级结构）
  randomizePositions(processedNodes);

  // 选中所有处理过的节点
  figma.currentPage.selection = processedNodes;
  
  // 通知用户操作完成
  figma.notify(`成功将 ${processedNodes.length} 个节点转换为图像`);
  
  // 关闭插件
  figma.closePlugin();
}

// 运行主函数
main();
