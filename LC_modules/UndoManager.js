class UndoManager {
    constructor() {
        this.undoStack = [];
        this.redoStack = []; 
    }

    // save current state
    saveState(state) {
        // stack with deep copy
        this.undoStack.push(JSON.parse(JSON.stringify(state)));
        //initiarise redo
        this.redoStack = [];
    }

    // Undo
    undo() {
        if (this.undoStack.length === 0) {
            console.log("Undo: There is no Undo history.");
            return null;
        }
        ////set redo
        const lastState = this.undoStack.pop();
        this.redoStack.push(lastState);
        console.log("Undo: Reconstruct last data.");
        return lastState;
    }

    redo(){
        if (this.redoStack.length === 0) {
            console.log("Undo: There is no Redo history.");
            return null;
        }
        const nextState = this.redoStack.pop();
        this.undoStack.push(nextState);
        
        return nextState;
    }

}

module.exports = { UndoManager };