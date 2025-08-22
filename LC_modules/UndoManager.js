// UndoManager.js

const jsondiffpatch = require('jsondiffpatch').create({
    objectHash: function(obj, index) {
    if (!obj || typeof obj !== 'object') return '$$' + index; // ★ガード
        const id = obj.id;

        // if string id
        if (typeof id === 'string' && id) {
            return id;
        }

        // if array id
        if (Array.isArray(id)) {
            const isMeaningfulId = !id.every(item => item === null);
            if (isMeaningfulId) {
                return id.toString();
            }
        }

        // if id is [null, null, null, null] or numeric
        return '$$' + index;
    }
});

class UndoManager {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.lastState = null;
        this.start = 0;
    }

    setInitialState(initialState) {
        //this.findFunctionsInObject(initialState); //for debug
        this.undoStack = [];
        this.redoStack = [];
        this.lastState = JSON.parse(JSON.stringify(initialState));
        //this.lastState = structuredClone(initialState);
    }

    /**
     * @param {object} currentState The current state.
     * @param {string} operationName A name for the action (e.g., 'Add Item').
     */
    saveState(currentState, operationName = 'Unnamed Action') { 
        //Add operationName parameter
        if (this.lastState === null) {
            console.warn("UndoManager: Please set the initial state using setInitialState().");
            return;
        }

        const delta = jsondiffpatch.diff(this.lastState, JSON.parse(JSON.stringify(currentState)));

        if (delta) {
            //Save the delta and operation name as an object
            const historyEntry = {
                name: operationName,
                delta: delta
            };
            this.undoStack.push(historyEntry);
            this.redoStack = [];
        }

        this.lastState = JSON.parse(JSON.stringify(currentState));
    }

    /**
     * @returns {{state: object, name: string, delta: object}|null}
     */
    undo() {
        if (this.undoStack.length === 0 || this.undoStack.length === this.start) {
            return null;
        }

        // Get the entire historyEntry object
        const historyEntry = this.undoStack.pop();
        this.redoStack.push(historyEntry);

        // Use the delta from the historyEntry
        const previousState = jsondiffpatch.unpatch(this.lastState, historyEntry.delta);
        
        this.lastState = previousState;

        // Return the restored state and the name of the undone action
        return {
            state: JSON.parse(JSON.stringify(previousState)),
            name: historyEntry.name,
            delta: historyEntry.delta
        };
    }

    /**
     * @returns {{state: object, name: string, delta: object}|null}
     */
    redo() {
        if (this.redoStack.length === 0) {
            return null;
        }

        // Get the entire historyEntry object
        const historyEntry = this.redoStack.pop();
        this.undoStack.push(historyEntry);

        // Use the delta from the historyEntry
        const nextState = jsondiffpatch.patch(this.lastState, historyEntry.delta);

        this.lastState = nextState;

        // Return the restored state and the name of the redone action
        return {
            state: JSON.parse(JSON.stringify(nextState)),
            name: historyEntry.name,
            delta: historyEntry.delta
        };
    }
    
    findFunctionsInObject(obj, path = '') {
        //for debud
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const newPath = path ? `${path}.${key}` : key;
            const value = obj[key];

            if (typeof value === 'function') {
                console.error(`[debug]: found function:  ${newPath}`);
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                this.findFunctionsInObject(value, newPath);
            }
            }
        }
    }
       
}

module.exports = { UndoManager };