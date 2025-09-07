const graphcanvas = document.getElementById(`graph`);
const w = graphcanvas.width = window.innerWidth;
const h = graphcanvas.height = window.innerHeight;
const graphctx = graphcanvas.getContext(`2d`);

let tick = 0;
let ox = 0; let oy = 100; let zoom = 1;
let alpha = 0.8;
let beta = 0; // X-axis rotation
let gamma = 0; // Z-axis rotation
let graphbutton = false;
let mouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;
var render_lock = false;
var save_start_board = board_string;

var config = {
	colors: {options:["Distance from Start", "Distance from Solution", "Off"], select:0},
    solutions: {options:["Invisible", "Visible"], select:0},
    path: {options:["Invisible", "Visible"], select:0},
};

let nodes = {};

increment_max();

var hash = 0;

function increment_max(){
    var max_x = 0;
    for (const name in nodes_to_use){
        max_x = Math.max(nodes_to_use[name].x, max_x);
    }
    for (const name in nodes_to_use){
        node = nodes_to_use[name];
        nodes[name] = node;
        node.x*=w*.2/max_x;
        node.y*=w*.2/max_x;
        node.z*=w*.2/max_x;
        delete nodes_to_use[name];
    }
}

function render_blurb(){
    graphctx.globalAlpha = 1;
    var y = h - 300; // Increased space for more controls
    graphctx.fillStyle = "white";
    graphctx.font = "16px Arial";
    graphctx.fillText("Configuration", 20, y+=16)
    graphctx.fillText("[c] Colors: " + config.colors.options[config.colors.select], 20, y+=16)
    graphctx.fillText("[s] Show Solutions: " + config.solutions.options[config.solutions.select], 20, y+=16)
    graphctx.fillText("[p] Shortest Path: " + config.path.options[config.path.select], 20, y+=16)
    graphctx.fillText("[r] Reset Board", 20, y+=16)
    graphctx.fillText("[Space] Reset Camera", 20, y+=16)
    graphctx.fillText("", 20, y+=16)
    graphctx.fillText("Controls:", 20, y+=16)
    graphctx.fillText("• Arrow Keys: Pan camera", 20, y+=16)
    graphctx.fillText("• Mouse Wheel: Zoom in/out", 20, y+=16)
    graphctx.fillText("• +/- Keys: Zoom in/out", 20, y+=16)
    graphctx.fillText("• A/D: Rotate Y-axis", 20, y+=16)
    graphctx.fillText("• W/S: Rotate X-axis", 20, y+=16)
    graphctx.fillText("• Q/E: Rotate Z-axis", 20, y+=16)
    graphctx.fillText("• Right-click + drag: Free rotation", 20, y+=16)
    graphctx.fillText("• Left-click: Teleport to position", 20, y+=16)
    graphctx.fillText("", 20, y+=16)
    graphctx.fillText("This is the Klotski puzzle.", 20, y+=16)
    graphctx.fillText("The right depicts the graph of all positions of the puzzle.", 20, y+=16)
    graphctx.fillText("You can navigate the white circle by sliding pieces in the top left.", 20, y+=16)
    graphctx.fillText("There are a total of 25,955 unique positions.", 20, y+=16)
    graphctx.fillText("Slide pieces to move the large piece to the bottom center.", 20, y+=16)
}

function render_histogram(){
    var l = histogram_solutions.length;
    var max = 0;
    for(var i = 0; i < l; i++){
        var hns= histogram_non_solutions[i];
        var hs = histogram_solutions[i];
        max = Math.max(max, hns+hs);
    }

    graphctx.globalAlpha = 1;
    for(var i = 0; i < l+1; i++){
        var hns= histogram_non_solutions[i];
        var hs = histogram_solutions[i];
        var dark = i == nodes[hash].dist?.5:1;
        graphctx.fillStyle = color_wheel(i, dark);
        var bar_width = (hns+hs)*300/max;
        graphctx.fillRect(w-bar_width, h*i/l, bar_width, h/l+1);

        hs = histogram_solutions[i-1];
        dark = i-1 == nodes[hash].dist?.25:.5;
        graphctx.fillStyle = color_wheel(i-1, dark);
        bar_width = hs*300/max;
        graphctx.fillRect(w-bar_width, h*(i-1)/l, bar_width, h/l+1);
    }
}

// Add the button to the page
const autoBtn = document.createElement('button');
autoBtn.textContent = 'Auto Traverse Best Path';
autoBtn.style.position = 'fixed';
autoBtn.style.top = '20px';
autoBtn.style.right = '20px';
autoBtn.style.zIndex = 1000;
autoBtn.style.fontSize = '18px';
autoBtn.style.padding = '8px 16px';
document.body.appendChild(autoBtn);

// Find the best path (shortest path to solution)
function get_best_path(startHash) {
    let path = [];
    let curr = nodes[startHash];
    if (!curr) return path;
    while (curr.solution_dist !== 0) {
        path.push(curr);
        let next = null;
        for (let i in curr.neighbors) {
            let neighbor = nodes[curr.neighbors[i]];
            if (neighbor && neighbor.solution_dist < curr.solution_dist) {
                next = neighbor;
                break;
            }
        }
        if (!next) break;
        curr = next;
    }
    path.push(curr); // Add solution node
    return path;
}

// Animate traversal, only calling render() for refresh
autoBtn.onclick = function() {
    let path = get_best_path(hash);
    let i = 0;
    function step() {
        if (i >= path.length) return;
        hash = Object.keys(nodes).find(k => nodes[k] === path[i]);
        board_string = path[i].representation;
        on_board_change();
        render(); // Only refresh when render is called
        i++;
        setTimeout(step, 500); // 500ms per step
    }
    step();
};

function render_graph() {
    render_lock = true;
    graphctx.globalAlpha = 1;
    graphctx.fillStyle = `Black`;
    graphctx.fillRect(0, 0, w, h);
    graphctx.lineWidth = 0.5;
    for (const name in nodes) get_node_coordinates(name);
    for (const name in nodes) {
        const node = nodes[name];
        for (const neighbor_name in node.neighbors) {
            const neighbor = nodes[node.neighbors[neighbor_name]];
            if(typeof neighbor == "undefined") continue;
            if(node.dist > neighbor.dist || (node.dist == neighbor.dist && node.x < neighbor.x)) continue;
            if(config.colors.select == 0)graphctx.strokeStyle = color_wheel(node.dist);
            else if(config.colors.select == 1)graphctx.strokeStyle = color_wheel(node.solution_dist);
            else graphctx.strokeStyle = "gray";
            graphctx.beginPath();
            graphctx.moveTo(node.screen_x, node.screen_y);
            graphctx.lineTo(neighbor.screen_x, neighbor.screen_y);
            graphctx.stroke();
        }
        if(config.solutions.select == 1 && node.solution_dist == 0){
            graphctx.strokeStyle = `white`;
            graphctx.beginPath();
            graphctx.arc(node.screen_x, node.screen_y, 5, 0, 2*Math.PI);
            graphctx.stroke();
        }
    }
    graphctx.strokeStyle = `white`;
    graphctx.lineWidth = 2;
    graphctx.beginPath();
    graphctx.arc(nodes[hash].screen_x, nodes[hash].screen_y, 10, 0, 2*Math.PI);
    graphctx.stroke();

    if(config.path.select == 1){
        var curr_node = nodes[hash];
        while(curr_node.solution_dist != 0){
            for(i in curr_node.neighbors){
                var neighbor = nodes[curr_node.neighbors[i]];
                if(neighbor.solution_dist < curr_node.solution_dist){

                    graphctx.beginPath();
                    graphctx.moveTo(curr_node.screen_x, curr_node.screen_y);
                    graphctx.lineTo(neighbor.screen_x, neighbor.screen_y);
                    graphctx.stroke();

                    curr_node = neighbor;
                    break;
                }
            }
        }
    }
}

function render () {
    if(render_lock) return;

    render_graph();
    render_blurb();
    render_histogram();

    render_lock = false;
}

function get_node_coordinates(hash) {
    var node = nodes[hash];
    
    // Apply 3D rotations
    // Rotate around Y-axis (alpha)
    let x1 = node.x * Math.cos(alpha) - node.z * Math.sin(alpha);
    let z1 = node.x * Math.sin(alpha) + node.z * Math.cos(alpha);
    let y1 = node.y;
    
    // Rotate around X-axis (beta)
    let y2 = y1 * Math.cos(beta) - z1 * Math.sin(beta);
    let z2 = y1 * Math.sin(beta) + z1 * Math.cos(beta);
    let x2 = x1;
    
    // Rotate around Z-axis (gamma)
    let x3 = x2 * Math.cos(gamma) - y2 * Math.sin(gamma);
    let y3 = x2 * Math.sin(gamma) + y2 * Math.cos(gamma);
    
    // Apply pan and zoom
    nodes[hash].screen_x = (x3 - ox) / zoom + w / 2;
    nodes[hash].screen_y = (y3 - oy) / zoom + h / 2;
}

function get_closest_node_to (coords) {
    var min_dist = 100000000;
    var best_node = "";
    for (const name in nodes) {
        const node = nodes[name];
        var d = Math.hypot(node.screen_x-coords.x, node.screen_y-coords.y);
        if (d < min_dist) {
            min_dist = d;
            best_node = name;
        }
    }
    console.log(min_dist)
    if(min_dist > 30) return hash;
    return best_node;
}

function color_wheel(angle, brightness=1){
    angle*=0.025;
    var r = normsin(angle)*brightness;
    var g = normsin(angle+Math.PI*2.0/3)*brightness;
    var b = normsin(angle+Math.PI*4.0/3)*brightness;
    return "rgb("+r+","+g+","+b+")";
}

function normsin(angle){
    return Math.floor(128.0*(Math.sin(angle)+1));
}

// Enhanced wheel event with zoom limits
window.addEventListener(`wheel`,
    (event) => {
        const zoomFactor = Math.pow(1.1, -Math.sign(event.deltaY));
        const newZoom = zoom * zoomFactor;
        
        // Add zoom limits
        if (newZoom >= 0.1 && newZoom <= 50) {
            zoom = newZoom;
        }
        
        if(!render_lock)render();
    }
);

// Enhanced mouse controls
graphcanvas.addEventListener(`mousedown`, function(e){
    if (e.button === 2) { // Right mouse button for rotation
        mouseDown = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        e.preventDefault(); // Prevent context menu
    } else {
        // Left click for teleporting to nodes
        graphbutton = true;
        var rect = graphcanvas.getBoundingClientRect();
        var screen_coords = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        board_string = nodes[get_closest_node_to(screen_coords)].representation;
        on_board_change();
    }
}, false);

graphcanvas.addEventListener(`mouseup`, function(e){
    mouseDown = false;
    graphbutton = false;
}, false);

graphcanvas.addEventListener(`mousemove`, function(e){
    if (mouseDown && e.buttons === 2) { // Right button drag for rotation
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        
        alpha += deltaX * 0.01; // Horizontal mouse movement rotates around Y-axis
        beta += deltaY * 0.01;  // Vertical mouse movement rotates around X-axis
        
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        
        if (!render_lock) render();
    }
}, false);

// Prevent context menu on right click
graphcanvas.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
}, false);

// Touch controls for mobile
let touchStartDistance = 0;
let touchStartAlpha = 0;
let touchStartBeta = 0;

graphcanvas.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2) {
        // Two finger pinch for zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        touchStartDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        touchStartAlpha = alpha;
        touchStartBeta = beta;
    }
    e.preventDefault();
}, false);

graphcanvas.addEventListener('touchmove', function(e) {
    if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        
        // Zoom based on pinch
        if (touchStartDistance > 0) {
            const zoomFactor = currentDistance / touchStartDistance;
            zoom *= zoomFactor * 0.1 + 0.9; // Smooth the zoom
        }
        
        // Rotation based on touch movement
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        alpha = touchStartAlpha + (centerX - w/2) * 0.001;
        beta = touchStartBeta + (centerY - h/2) * 0.001;
        
        if (!render_lock) render();
    }
    e.preventDefault();
}, false);

window.addEventListener(`keydown`, key, false);

function key (e) {
    const c = e.keyCode;
    console.log(c + " " + "r".charCodeAt(0));
    
    // Pan controls
    if (c == 37) ox -= zoom * 100; // Left arrow
    if (c == 38) oy -= zoom * 100; // Up arrow
    if (c == 39) ox += zoom * 100; // Right arrow
    if (c == 40) oy += zoom * 100; // Down arrow
    
    // Rotation controls
    if (c == 65) alpha -= .04; // A - rotate left around Y-axis
    if (c == 68) alpha += .04; // D - rotate right around Y-axis
    if (c == 87) beta -= .04;  // W - rotate up around X-axis
    if (c == 83) beta += .04;  // S - rotate down around X-axis
    if (c == 81) gamma -= .04; // Q - rotate left around Z-axis
    if (c == 69) gamma += .04; // E - rotate right around Z-axis
    
    // Zoom controls
    if (c == 187 || c == 61) { // + or = key - zoom in
        const newZoom = zoom / 1.2;
        if (newZoom >= 0.1) zoom = newZoom;
    }
    if (c == 189 || c == 173) { // - key - zoom out
        const newZoom = zoom * 1.2;
        if (newZoom <= 50) zoom = newZoom;
    }
    
    // Configuration toggles
    if (c == 67) config.colors.select = (config.colors.select + 1) % config.colors.options.length; // C
    if (c == 83) config.solutions.select = (config.solutions.select + 1) % config.solutions.options.length; // S (note: this will conflict with rotation S, you may want to change this)
    if (c == 80) config.path.select = (config.path.select + 1) % config.path.options.length; // P
    if (c == 82) board_string = save_start_board; // R - reset board
    
    // Reset view
    if (c == 32) { // Spacebar - reset camera
        ox = 0; oy = 100; zoom = 1;
        alpha = 0.8; beta = 0; gamma = 0;
    }
    
    on_board_change();
}

var square_sz = 40;

const boardcanvas = document.getElementById(`board`);
boardcanvas.width = (parseInt(board_w)+1)*square_sz;
boardcanvas.height = (parseInt(board_h)+1)*square_sz;
const boardctx = boardcanvas.getContext(`2d`);

let boardbutton = false;
let board_click_start = {x:0,y:0};
let diffcoords = {x:0,y:0};
let board_click_square = ';';

setInterval(render_board, 10);

var EMPTY_SPACE = '.';

hash = get_hash();
if(!render_lock)render();

function render_board () {
    for(i = 0; i < 3; i++){
        boardctx.fillStyle = ([`#000`, `#222`, `#000`])[i];
        var margin = i*square_sz/5;
        boardctx.fillRect(0+margin, 0+margin, boardcanvas.width-2*margin, boardcanvas.height-2*margin);
    }
    for (var y = 0; y < board_h; y++){
        for (var x = 0; x < board_w; x++){
            var spot = y*board_w+x;
            var charcode = board_string.charCodeAt(spot);
            var character = board_string.charAt(spot);
            if(character == EMPTY_SPACE) continue;
            boardctx.fillStyle = color_wheel(72.819*2*charcode);
            var conddiff = (character == board_click_square && can_move_piece(Math.sign(diffcoords.y), Math.sign(diffcoords.x)))?diffcoords:{x:0,y:0};
            boardctx.fillRect(boardcanvas.width/2+(x-board_w/2)*square_sz+conddiff.x,boardcanvas.height/2+(y-board_h/2)*square_sz+conddiff.y,square_sz,square_sz);
        }
    }
}

function in_bounds(min, val, max){ return min <= val && val < max; }

function can_move_piece(dy, dx){
    if(rushhour==1 && (board_click_square.charCodeAt(0) - 'a'.charCodeAt(0) + dy)%2==0) return false;
    for(var y = 0; y < board_h; y++)
        for(var x = 0; x < board_w; x++){
            if(board_string.charAt(y*board_w+x) == board_click_square) {
                var inside = in_bounds(0, y+dy, board_h) && in_bounds(0, x+dx, board_w);
                var target = board_string.charAt((y+dy)*board_w+(x+dx));
                if(!inside || (target != EMPTY_SPACE && target != board_click_square))
                    return false;
            }
            else continue;
        }
    return true;
}

function move_piece(dy, dx){
    var board_string_new = '';
    for(var i = 0; i < w*h; i++)board_string_new += ".";
    for(var y = 0; y < board_h; y++)
        for(var x = 0; x < board_w; x++){
            var position = y*board_w+x;
            var letter_here = board_string.charAt(position);
            if(letter_here == board_click_square) {
                var target = (y+dy)*board_w+(x+dx);
                board_string_new = board_string_new.slice(0, target) + board_click_square + board_string_new.slice(target+1);
            }
            else if(letter_here != EMPTY_SPACE)
                board_string_new = board_string_new.slice(0, position) + letter_here + board_string_new.slice(position+1);
        }
    board_string = board_string_new;
}

function on_board_change(){
    hash = get_hash();
    if(!render_lock)render();
}

var board_release = function(){
    boardbutton = false;
    var dx = Math.sign(diffcoords.x);
    var dy = Math.sign(diffcoords.y);
    if(can_move_piece(dy, dx)) move_piece(dy, dx);
    board_click_start = {x:0,y:0};
    diffcoords = {x:0,y:0};
    on_board_change();
}

boardcanvas.addEventListener(`mousedown`, function(e){
    boardbutton = true;
    var rect = boardcanvas.getBoundingClientRect();
    board_click_start = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    var x = Math.floor(((board_click_start.x - boardcanvas.width/2)/square_sz)+board_w/2);
    var y = Math.floor(((board_click_start.y - boardcanvas.height/2)/square_sz)+board_h/2);
    diffcoords = {x:0,y:0};
    board_click_square = board_string.charAt(x+y*board_w);
    if(!(in_bounds(0, y, board_h) && in_bounds(0, x, board_w))) board_click_square = ';';
}, false);
boardcanvas.addEventListener(`mouseup`, board_release, false);
boardcanvas.addEventListener(`mouseleave`, board_release, false);
boardcanvas.addEventListener(`mousemove`, function(e){
    if(!boardbutton) return;
    var rect = boardcanvas.getBoundingClientRect();
    var screen_coords = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    diffcoords = {
        x:screen_coords.x-board_click_start.x,
        y:screen_coords.y-board_click_start.y
    };
    if(Math.abs(diffcoords.x) > Math.abs(diffcoords.y))
        diffcoords.y = 0;
    else
        diffcoords.x = 0;
    diffcoords.x = Math.min(square_sz, Math.max(-square_sz, diffcoords.x));
    diffcoords.y = Math.min(square_sz, Math.max(-square_sz, diffcoords.y));
}, false);

function get_hash() {
    var semihash = 0;
    var obj = {"a":0, "b":0, "c":0, "d":0, "e":0, "f":0, "g":0, "h":0, "i":0, "j":0, "k":0, "l":0, "m":0, "n":0, "o":0, "p":0, "q":0, "r":0, "s":0, "t":0, "u":0, "v":0, "w":0, "x":0, "y":0, "z":0}
    var sum = 0;
    for(var y = 0; y < board_h; y++)
        for(var x = 0; x < board_w; x++){
            var letter = board_string.charAt(y*board_w+x);
            if(letter != EMPTY_SPACE){
                var i=y*board_w+x;
                obj[letter] += Math.sin((i+1)*Math.cbrt(i+2));
            }
        }
    for(letter in obj) semihash+=Math.cbrt(obj[letter]);

    var closedist = 10000;
    var closename = 0;
    for(name in nodes){
        var dist = Math.abs(semihash-name);
        if(dist < closedist){
            closename = name;
            closedist = dist;
        }
    }
    return closename;
}