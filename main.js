"use strict";

var isMobile = false; //initiate as false
// device detection
function checkForMobile() {
    if(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)){
        // true for mobile device
        console.log("mobile device");
        isMobile = true;
    }else{
        // false for not mobile device
        console.log("not mobile device");
        isMobile = false;
    }
}

checkForMobile();

let MSGame = (function(){

    // private constants
    const STATE_HIDDEN = "hidden";
    const STATE_SHOWN = "shown";
    const STATE_MARKED = "marked";

    function array2d( nrows, ncols, val) {
        const res = [];
        for( let row = 0 ; row < nrows ; row ++) {
            res[row] = [];
            for( let col = 0 ; col < ncols ; col ++)
                res[row][col] = val(row,col);
        }
        return res;
    }

    // returns random integer in range [min, max]
    function rndInt(min, max) {
        [min,max] = [Math.ceil(min), Math.floor(max)]
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    class _MSGame {
        constructor() {
            this.init(10, 10, 10); // easy by default
        }

        validCoord(row, col) {
            return row >= 0 && row < this.nrows && col >= 0 && col < this.ncols;
        }

        init(nrows, ncols, nmines) {
            this.nrows = nrows;
            this.ncols = ncols;
            this.nmines = nmines;
            this.nmarked = 0;
            this.nuncovered = 0;
            this.exploded = false;
            // create an array
            this.arr = array2d(
                nrows, ncols,
                () => ({mine: false, state: STATE_HIDDEN, count: 0}));
        }

        count(row,col) {
            const c = (r,c) =>
                (this.validCoord(r,c) && this.arr[r][c].mine ? 1 : 0);
            let res = 0;
            for( let dr = -1 ; dr <= 1 ; dr ++ )
                for( let dc = -1 ; dc <= 1 ; dc ++ )
                    res += c(row+dr,col+dc);
            return res;
        }
        sprinkleMines(row, col) {
            // prepare a list of allowed coordinates for mine placement
            let allowed = [];
            for(let r = 0 ; r < this.nrows ; r ++ ) {
                for( let c = 0 ; c < this.ncols ; c ++ ) {
                    if(Math.abs(row-r) > 2 || Math.abs(col-c) > 2)
                        allowed.push([r,c]);
                }
            }
            this.nmines = Math.min(this.nmines, allowed.length);
            for( let i = 0 ; i < this.nmines ; i ++ ) {
                let j = rndInt(i, allowed.length-1);
                [allowed[i], allowed[j]] = [allowed[j], allowed[i]];
                let [r,c] = allowed[i];
                this.arr[r][c].mine = true;
            }
            // erase any marks (in case user placed them) and update counts
            for(let r = 0 ; r < this.nrows ; r ++ ) {
                for( let c = 0 ; c < this.ncols ; c ++ ) {
                    if(this.arr[r][c].state === STATE_MARKED)
                        this.arr[r][c].state = STATE_HIDDEN;
                    this.arr[r][c].count = this.count(r,c);
                }
            }
            let mines = []; let counts = [];
            for(let row = 0 ; row < this.nrows ; row ++ ) {
                let s = "";
                for( let col = 0 ; col < this.ncols ; col ++ ) {
                    s += this.arr[row][col].mine ? "B" : ".";
                }
                s += "  |  ";
                for( let col = 0 ; col < this.ncols ; col ++ ) {
                    s += this.arr[row][col].count.toString();
                }
                mines[row] = s;
            }
            this.nmarked = 0; //fixed the bug that kept cells marked when starting the game
            console.log("Mines and counts after sprinkling:");
            console.log(mines.join("\n"), "\n");
        }
        // puts a flag on a cell
        // this is the 'right-click' or 'long-tap' functionality
        uncover(row, col) {
            console.log("uncover", row, col);
            // if coordinates invalid, refuse this request
            if( ! this.validCoord(row,col)) return false;
            // if this is the very first move, populate the mines, but make
            // sure the current cell does not get a mine
            if( this.nuncovered === 0)
                this.sprinkleMines(row, col);
            // if cell is not hidden, ignore this move
            if( this.arr[row][col].state !== STATE_HIDDEN) return false;
            // floodfill all 0-count cells
            const ff = (r,c) => {
                if( ! this.validCoord(r,c)) return;
                if( this.arr[r][c].state !== STATE_HIDDEN) return;
                this.arr[r][c].state = STATE_SHOWN;
                this.nuncovered ++;
                if( this.arr[r][c].count !== 0) return;
                ff(r-1,c-1);ff(r-1,c);ff(r-1,c+1);
                ff(r  ,c-1);         ;ff(r  ,c+1);
                ff(r+1,c-1);ff(r+1,c);ff(r+1,c+1);
            };
            ff(row,col);
            // have we hit a mine?
            if( this.arr[row][col].mine) {
                this.exploded = true;
            }
            return true;
        }
        // uncovers a cell at a given coordinate
        // this is the 'left-click' functionality
        mark(row, col) {
            console.log("mark", row, col);
            // if coordinates invalid, refuse this request
            if( ! this.validCoord(row,col)) return false;
            // if cell already uncovered, refuse this
            console.log("marking previous state=", this.arr[row][col].state);
            if( this.arr[row][col].state === STATE_SHOWN) return false;
            // accept the move and flip the marked status
            this.nmarked += this.arr[row][col].state === STATE_MARKED ? -1 : 1;
            this.arr[row][col].state = this.arr[row][col].state === STATE_MARKED ?
                STATE_HIDDEN : STATE_MARKED;
            return true;
        }
        // returns array of strings representing the rendering of the board
        //      "H" = hidden cell - no bomb
        //      "F" = hidden cell with a mark / flag
        //      "M" = uncovered mine (game should be over now)
        // '0'..'9' = number of mines in adjacent cells
        getRendering() {
            const res = [];
            for( let row = 0 ; row < this.nrows ; row ++) {
                let s = "";
                for( let col = 0 ; col < this.ncols ; col ++ ) {
                    let a = this.arr[row][col];
                    if( this.exploded && a.mine) s += "M";
                    else if( a.state === STATE_HIDDEN) s += "H";
                    else if( a.state === STATE_MARKED) s += "F";
                    else if( a.mine) s += "M";
                    else s += a.count.toString();
                }
                res[row] = s;
            }
            return res;
        }
        getStatus() {
            let done = this.exploded ||
                this.nuncovered === this.nrows * this.ncols - this.nmines;
            return {
                done: done,
                exploded: this.exploded,
                nrows: this.nrows,
                ncols: this.ncols,
                nmarked: this.nmarked,
                nuncovered: this.nuncovered,
                nmines: this.nmines
            }
        }
    }

    return _MSGame;

})();

function leftClick(game, card) {
    let [row,col] = card.dataset.position.split("x");
    row = Number(row)
    col = Number(col)
    game.uncover(row,col);
    renderBoard(game);
    rightClicked = false;
}

function rightClick(game, card) {
    let [row,col] = card.dataset.position.split("x");
    row = Number(row);;
    col = Number(col)
    game.mark(row,col);
    renderBoard(game);
}

function setTimer(game){
    if(game.getStatus().nuncovered !== 0 && !game.getStatus().done){
        time++
    }
    document.querySelector(".gameTimer").innerHTML = "Timer: " + time
}

var timer;
var rightClicked = false;
//Time of the long press
const tempo = 1000; //Time 1000ms = 1s

function mouseDown(game, card) {
    timer = setTimeout(function(){
        rightClick(game, card);
    }, tempo);
};

function mouseUp(game, card) {
    clearTimeout(timer);
    if (!rightClicked)
        leftClick(game, card);
    rightClicked = false;
};

function wireupMobileEvents(game, card) {
    card.ontouchstart = () => mouseDown(game, card);
    card.ontouchend = () => mouseUp(game, card);
    card.onmouseup = () => mouseUp(game, card);
}

function renderBoard(game) {
    const grid = document.querySelector(".grid");
    const gridWrapper = document.querySelector(".gridwrapper");
    grid.innerHTML = "";
    const board = game.getRendering();
    document.querySelector(".flagCounter").innerHTML = "Flags: " + (game.getStatus().nmines - game.getStatus().nmarked);
    checkForMobile();
    
    //add the easy and normal grid things
    let jqueryGrid = $(".grid");
    jqueryGrid.removeClass("grid-easy")
    jqueryGrid.removeClass("grid-normal")
    if(board.length === 10){
        jqueryGrid.addClass("grid-easy")
    }
    else {
        jqueryGrid.addClass("grid-normal");
    }

    for( let row = 0 ; row < board.length ; row ++) {
        for(let col = 0; col < board[row].length; col++){
            let cell = board[row][col];
            //console.log("row", row, "columns", col, "cell value", cell);
            const card = document.createElement("div");
            card.id = `${row}${col}`;
            card.className = "card";
            card.dataset.position = row+"x"+col;
            card.innerHTML = "";
            //card.innerHTML = row+"x"+col;
            let image = document.createElement("img");
            switch (cell) {
                case "H":
                    image.src = "images/facingDown.png";
                    break;
                case "F":
                    image.src = "images/flagged.png";
                    break;
                case "M":
                    image.src = "images/bomb.png";
                    break;
                default:
                    image.src = "images/" + cell + ".png";
                    break;
            }
            image.className = "cardImage";
            card.appendChild(image);
            // card.className = "card";
            // card.setAttribute("data-cardInd", i);
            if(!game.getStatus().done){
                if (!isMobile) {
                    card.onmouseup = event => {
                        if (event.button === 0) {
                            leftClick(game, card);
                        } else {
                            rightClick(game, card);
                        }
                    };
                }
                else {
                    wireupMobileEvents(game, card);
                }
            }
            grid.appendChild(card);
        }
    }
    //check if game is done
    if(game.getStatus().done){
        //if the game is won or lost
        //loss
        if(game.getStatus().exploded){
            document.querySelector("#overlay").innerHTML = "You Lost"
            new Audio("./media/loss.mp3").play();
        } else {
            document.querySelector("#overlay").innerHTML = "You Won in " + time +" Seconds!"
            new Audio("./media/Win.mp3").play();
        }
        document.querySelector("#overlay").classList.add("active");
    }
}

function createBoardFromButton(button,game){
    let [row,col,mines] = button.getAttribute("data-size").split("x");
    row = Number(row); col = Number(col); mines = Number(mines);
    game.init(row,col,mines)
    renderBoard(game)
    //remove win overlay if exists
    document.querySelector("#overlay").classList.remove("active")
    //reset timer
    time = 0;
  }


function main(){

    let html = document.querySelector("html");
    console.log("Your render area:", html.clientWidth, "x", html.clientHeight);
    // register callbacks for buttons
    document.querySelectorAll(".difficultyButton").forEach((button) =>{
    button.addEventListener("click",function(){
      createBoardFromButton(button,game)
        })
    });
    renderBoard(game);
    window.setInterval(x => setTimer(game),1000);

}
let time = 0;
let hadStarted = false;
let game = new MSGame();
window.addEventListener('load', main);
