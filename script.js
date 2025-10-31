// --- Constants for SVG Rendering ---
const SVG_NS = "http://www.w3.org/2000/svg";
const NODE_RADIUS = 20;
const VERTICAL_SPACING = 70;
const HORIZONTAL_SPACING = 50;

// --- Global variables for tree rendering ---
let maxDepth = 0;
let xCursor = 0; 

// --- Game State Variables ---
let currentTree = null;
let validationResult = {}; // Holds {valid, height, reason, violatingNode}
let allNodes = []; // Flat list of all nodes for random selection
let currentQuestion = { type: '', targetNode: null, correctAnswer: null };
let score = 0;
let answerGiven = false;

// --- DOM Elements ---
const avlTreeSvg = document.getElementById('avl-tree-svg');
const feedbackDiv = document.getElementById('feedback');
const scoreDisplay = document.getElementById('score');
const questionText = document.getElementById('question-text');
const booleanControls = document.getElementById('boolean-controls');
const inputControls = document.getElementById('input-controls');
const correctBtn = document.getElementById('correct-btn');
const incorrectBtn = document.getElementById('incorrect-btn');
const bfInput = document.getElementById('bf-input');
const submitBfBtn = document.getElementById('submit-bf-btn');
const nextBtn = document.getElementById('next-btn');


// --- AVL Tree Logic Helpers ---

function calculateHeight(node) {
    if (!node) return -1;
    const leftHeight = calculateHeight(node[1]);
    const rightHeight = calculateHeight(node[2]);
    return 1 + Math.max(leftHeight, rightHeight);
}

/**
 * Checks if the entire tree is a valid AVL tree, updates balance factors, and tracks the reason for failure.
 */
function isAVL(node) {
    if (!node) return { valid: true, height: -1, reason: null, violatingNode: null };

    // Add node to flat list for question targeting
    allNodes.push(node);

    const leftResult = isAVL(node[1]);
    const rightResult = isAVL(node[2]);

    // Pass failure reason up immediately
    if (!leftResult.valid) return leftResult;
    if (!rightResult.valid) return rightResult;

    const balanceFactor = leftResult.height - rightResult.height;
    node[3] = balanceFactor; // Store BF for display

    const isBalanced = Math.abs(balanceFactor) <= 1;
    
    let reason = null;
    let violatingNode = null;
    let isValid = true;

    if (!isBalanced) {
        isValid = false;
        violatingNode = node;
        reason = `Node ${node[0]} has a Balance Factor (BF) of ${balanceFactor} (Left Height: ${leftResult.height}, Right Height: ${rightResult.height}). The BF must be between -1 and 1.`;
    }

    return {
        valid: isValid,
        height: 1 + Math.max(leftResult.height, rightResult.height),
        reason: reason,
        violatingNode: violatingNode
    };
}


/**
 * Determines the required rotation type for an unbalanced node (if any).
 */
function getRotationType(violatingNode) {
    if (!violatingNode || Math.abs(violatingNode[3]) <= 1) return 'None';

    const rootBF = violatingNode[3];
    const child = (rootBF > 0) ? violatingNode[1] : violatingNode[2]; // Taller child
    
    if (!child) return 'Simple'; 

    const childBF = child[3];

    if (rootBF > 1) { // Left-heavy
        if (childBF >= 0) return 'LL (Right Rotation)'; 
        if (childBF < 0) return 'LR (Double Rotation: Left then Right)';
    } else if (rootBF < -1) { // Right-heavy
        if (childBF <= 0) return 'RR (Left Rotation)'; 
        if (childBF > 0) return 'RL (Double Rotation: Right then Left)';
    }

    return 'None';
}


/**
 * Generates a random tree structure (potentially unbalanced) for the quiz.
 */
function generateRandomTree(depth = 0) {
    if (depth > 3 && Math.random() < 0.9) { return null; } 
    if (depth > 1 && Math.random() < 0.6) { return null; }
    
    const value = Math.floor(Math.random() * 99) + 1;

    const childChance = (depth === 0) ? 0.9 : 0.7;

    let left = Math.random() < childChance ? generateRandomTree(depth + 1) : null;
    let right = Math.random() < childChance ? generateRandomTree(depth + 1) : null;
    
    const node = [value, left, right, 0, 0, 0]; 

    // Introduce an imbalance randomly (30% chance at non-root levels)
    if (depth > 0 && Math.random() < 0.30) {
        if (Math.random() < 0.5) {
            // Force left-heavy imbalance:
            node[2] = null;
            if (node[1]) { 
                if (Math.random() < 0.7) node[1][1] = generateRandomTree(depth + 2); 
            } else {
                node[1] = generateRandomTree(depth + 1);
                if (node[1]) node[1][1] = generateRandomTree(depth + 2);
            }
        } else {
            // Force right-heavy imbalance:
            node[1] = null; 
            if (node[2]) { 
                if (Math.random() < 0.7) node[2][2] = generateRandomTree(depth + 2);
            } else {
                node[2] = generateRandomTree(depth + 1);
                if (node[2]) node[2][2] = generateRandomTree(depth + 2);
            }
        }
    }

    return node;
}


// --- SVG Rendering ---

function createSVGElement(name, attributes) {
    const el = document.createElementNS(SVG_NS, name);
    for (let key in attributes) { el.setAttribute(key, attributes[key]); }
    return el;
}

function calculateNodePositions(node, depth) {
    if (!node) return;
    maxDepth = Math.max(maxDepth, depth);
    calculateNodePositions(node[1], depth + 1);
    node[4] = xCursor; 
    node[5] = depth * VERTICAL_SPACING + NODE_RADIUS + 20; 
    xCursor++;
    calculateNodePositions(node[2], depth + 1);
}

function drawTree(root, svgElement, highlightNodeValue = null) {
    svgElement.innerHTML = ''; 
    if (!root) return;
    maxDepth = 0;
    xCursor = 0;
    calculateNodePositions(root, 0);

    const treeWidth = (xCursor) * HORIZONTAL_SPACING;
    const treeHeight = (maxDepth + 1) * VERTICAL_SPACING + NODE_RADIUS * 2 + 20;
    const svgWidth = Math.max(treeWidth + NODE_RADIUS * 2, 300);
    const svgHeight = Math.max(treeHeight, 200);

    svgElement.setAttribute('width', svgWidth);
    svgElement.setAttribute('height', svgHeight);
    const centerXOffset = (svgWidth - treeWidth) / 2 + NODE_RADIUS;

    function renderNode(node, parentX, parentY) {
        if (!node) return;

        const x = node[4] * HORIZONTAL_SPACING + centerXOffset;
        const y = node[5];
        const value = node[0];
        const balanceFactor = node[3];

        if (parentX !== undefined && parentY !== undefined) {
            const line = createSVGElement('line', {
                x1: parentX, y1: parentY + NODE_RADIUS,
                x2: x, y2: y - NODE_RADIUS,
                stroke: '#3498db', 'stroke-width': 2
            });
            svgElement.appendChild(line);
        }

        const isUnbalancedNode = Math.abs(balanceFactor) > 1;
        const isTargetNode = (highlightNodeValue !== null && value === highlightNodeValue);
        
        let fillColor = '#3498db'; // Default blue
        let strokeColor = '#2980b9';

        if (isUnbalancedNode) {
            fillColor = '#e74c3c'; // Red for imbalance
            strokeColor = '#c0392b';
        } else if (isTargetNode) {
            fillColor = '#ffc107'; // Yellow/Amber for targeted BF question
            strokeColor = '#e0a800';
        }

        // Draw node circle
        const circle = createSVGElement('circle', {
            cx: x, cy: y, r: NODE_RADIUS,
            fill: fillColor, 
            stroke: strokeColor,
            'stroke-width': 2
        });
        svgElement.appendChild(circle);

        // Draw value text
        const valueText = createSVGElement('text', {
            x: x, y: y + 5, 'text-anchor': 'middle', fill: 'white',
            'font-size': '12px', 'font-weight': 'bold'
        });
        valueText.textContent = value;
        svgElement.appendChild(valueText);

        // Draw balance factor text
        const bfText = createSVGElement('text', {
            x: x + NODE_RADIUS + 5, y: y + 5, fill: '#333', 'font-size': '10px'
        });
        bfText.textContent = `BF: ${balanceFactor}`; 
        svgElement.appendChild(bfText);

        renderNode(node[1], x, y); 
        renderNode(node[2], x, y); 
    }

    renderNode(root);
}


// --- Game Logic ---

/**
 * Selects a random question type and sets up the game state for it.
 */
function setupRandomQuestion() {
    // 1. Determine question pool
    const questionPool = ['isAVL']; 

    if (allNodes.length > 1) { 
        questionPool.push('getBF');
        questionPool.push('getBF'); 
    }

    if (!validationResult.valid) { 
        questionPool.push('getRotation');
    }

    // 2. Select a random question type
    const qType = questionPool[Math.floor(Math.random() * questionPool.length)];
    currentQuestion.type = qType;

    // 3. Setup question specifics
    if (qType === 'isAVL') {
        // Type 1: Is it AVL?
        questionText.innerHTML = `<strong>Is the following structure a correctly balanced AVL Tree?</strong>`;
        currentQuestion.correctAnswer = validationResult.valid;
        currentQuestion.targetNode = null;
        
        booleanControls.style.display = 'flex';
        inputControls.style.display = 'none';

        // Reset button labels
        correctBtn.textContent = 'Yes / Correct';
        incorrectBtn.textContent = 'No / Wrong';

    } else if (qType === 'getBF') {
        // Type 2: What is the BF of a specific node?
        // Pick a node that has children or is the root
        const eligibleNodes = allNodes.filter(n => n[1] || n[2] || n === currentTree);
        const targetNode = eligibleNodes[Math.floor(Math.random() * eligibleNodes.length)];
        
        questionText.innerHTML = `<strong>What is the Balance Factor (BF) for the highlighted Node ${targetNode[0]}?</strong>`;
        currentQuestion.correctAnswer = targetNode[3];
        currentQuestion.targetNode = targetNode;
        
        // Redraw to highlight the target node
        drawTree(currentTree, avlTreeSvg, targetNode[0]);
        
        booleanControls.style.display = 'none';
        inputControls.style.display = 'flex';
        bfInput.value = '';

    } else if (qType === 'getRotation') {
        // Type 3: What rotation is required? 
        const rotation = getRotationType(validationResult.violatingNode);
        
        // Determine if it's a single or double rotation
        const isSingleRotation = rotation === 'LL (Right Rotation)' || rotation === 'RR (Left Rotation)';
        currentQuestion.correctAnswer = isSingleRotation; 
        
        questionText.innerHTML = `This tree is unbalanced at Node ${validationResult.violatingNode[0]}. <strong>Is a single rotation (LL/RR) or a double rotation (LR/RL) required?</strong>`;
        
        // Set buttons for single/double
        correctBtn.textContent = 'Single (LL/RR)';
        incorrectBtn.textContent = 'Double (LR/RL)';
        
        drawTree(currentTree, avlTreeSvg, validationResult.violatingNode[0]);
        
        booleanControls.style.display = 'flex';
        inputControls.style.display = 'none';
    }
}

/**
 * Starts a new game cycle.
 */
function newQuestion() {
    let newTree;
    do {
        newTree = generateRandomTree();
    } while (newTree === null);
    
    allNodes = []; 
    
    // 1. Validate the tree, capturing the result and reason
    validationResult = isAVL(newTree);
    currentTree = newTree;

    // 2. Setup the random question
    setupRandomQuestion();

    // 3. Draw the tree (initial draw uses setupRandomQuestion's logic)
    // If it was a BF question, it's already drawn with highlight. If not, draw default.
    if (currentQuestion.type !== 'getBF') {
        drawTree(currentTree, avlTreeSvg, validationResult.violatingNode ? validationResult.violatingNode[0] : null);
    }
    
    // 4. Reset game state visuals
    feedbackDiv.textContent = '';
    feedbackDiv.className = 'feedback';
    nextBtn.style.display = 'none';
    correctBtn.disabled = false;
    incorrectBtn.disabled = false;
    submitBfBtn.disabled = false;
    answerGiven = false;
}

/**
 * Handles the user's answer for Boolean or Rotation questions.
 */
function handleBooleanAnswer(userAnswerIsCorrect) {
    if (answerGiven) return;
    answerGiven = true;

    const isCorrectAttempt = userAnswerIsCorrect === currentQuestion.correctAnswer;
    let feedbackMessage = '';
    
    if (currentQuestion.type === 'isAVL') {
        // Q1: Is it AVL?
        if (isCorrectAttempt) {
            score++;
            feedbackMessage = `✅ **Correct!** ${validationResult.valid ? 'The tree is valid.' : 'The tree is invalid.'} **Reason:** ${validationResult.valid ? 'All BFs are correct.' : validationResult.reason}`;
        } else {
            feedbackMessage = `❌ **Wrong!** The correct answer was **${validationResult.valid ? 'Yes, it is AVL.' : 'No, it is unbalanced.'}** **Reason:** ${validationResult.reason || 'All BFs are correct.'}`;
        }
    } else if (currentQuestion.type === 'getRotation') {
        // Q3: Single/Double Rotation?
        const rotationType = getRotationType(validationResult.violatingNode);
        const correctLabel = (currentQuestion.correctAnswer) ? 'Single Rotation' : 'Double Rotation';
        
        if (isCorrectAttempt) {
            score++;
            feedbackMessage = `✅ **Correct!** The imbalance (${rotationType}) requires a **${correctLabel}**.`;
        } else {
            feedbackMessage = `❌ **Wrong!** The imbalance (${rotationType}) actually requires a **${correctLabel}**.`;
        }
    }

    scoreDisplay.textContent = `Score: ${score}`;
    feedbackDiv.innerHTML = `<span style="font-size:1.1em;">${feedbackMessage}</span>`;
    feedbackDiv.classList.add(isCorrectAttempt ? 'correct' : 'wrong');
    correctBtn.disabled = true;
    incorrectBtn.disabled = true;
    nextBtn.style.display = 'block';
}

/**
 * Handles the user's answer for Balance Factor questions.
 */
function handleSubmitBF() {
    if (answerGiven) return;

    const userAnswer = parseInt(bfInput.value);
    if (isNaN(userAnswer)) {
        alert("Please enter a number for the Balance Factor.");
        return;
    }
    
    answerGiven = true;
    submitBfBtn.disabled = true;

    const correctAnswer = currentQuestion.correctAnswer;
    const isCorrectAttempt = userAnswer === correctAnswer;
    const nodeValue = currentQuestion.targetNode[0];

    let feedbackMessage = '';

    if (isCorrectAttempt) {
        score++;
        feedbackMessage = `✅ **Correct!** The BF for Node ${nodeValue} is indeed **${correctAnswer}**.`;
    } else {
        feedbackMessage = `❌ **Wrong!** The BF for Node ${nodeValue} is **${correctAnswer}**. (You calculated: ${userAnswer}).`;
    }

    scoreDisplay.textContent = `Score: ${score}`;
    feedbackDiv.innerHTML = `<span style="font-size:1.1em;">${feedbackMessage}</span>`;
    feedbackDiv.classList.add(isCorrectAttempt ? 'correct' : 'wrong');
    nextBtn.style.display = 'block';
}


// --- Event Listeners ---
correctBtn.addEventListener('click', () => handleBooleanAnswer(true));
incorrectBtn.addEventListener('click', () => handleBooleanAnswer(false));
submitBfBtn.addEventListener('click', handleSubmitBF);
nextBtn.addEventListener('click', newQuestion);

// Initialize the game on load
newQuestion();
