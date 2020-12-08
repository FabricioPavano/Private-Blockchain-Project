/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *  
 */

const SHA256 = require('crypto-js/sha256');
const Block = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');
const e = require('express');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if( this.height === -1){
            let block = new Block.Block({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * @param {*} address 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't for get 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    _addBlock(block, address) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            // Add Block Height
            block.height = await this.getChainHeight() + 1;

            // Add Previous Block Hash
            if(block.height != 0){
                const previous_block = await this.getBlockByHeight(block.height - 1);
                block.previousBlockHash = previous_block.hash;
            }

            // Add Timestamp
            block.time = new Date().getTime().toString().slice(0,-3)

            // Add address too
            block.address = address;

            // Add Hash
            block.hash = SHA256(JSON.stringify(block)).toString()

            self.chain.push(block);
            self.height += 1; 


            // Validate chain
            const isValid = await self.validateChain()

            if(isValid){
                resolve(block);
            }
            else{
                let invalidBlock = this.chain.pop()
                reject('invalid block', JSON.stringify(invalidBlock))
            }
            

        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            resolve(address + ':' + new Date().getTime().toString().slice(0,-3) + ':starRegistry')
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            let time = parseInt(message.split(':')[1])

            let currentTime = new Date().getTime().toString().slice(0,-3);

            if(currentTime - time > 300){
                reject(Error('too much time ellapsed'))
                return;
            } else {

                if(bitcoinMessage.verify(message, address, signature)){
                    let block = new Block.Block(star)
                    block = await self._addBlock(block, address)

                    resolve(block);
                    return;
                } else {
                    reject(Error('could not verify message'))
                    return;
                }
                
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        let self = this;
        return new Promise((resolve, reject) => {
            resolve(self.chain.find(b => b.hash === hash));
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.filter(p => p.height === height)[0];
            if(block){
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress (address) {
        let self = this;
        let stars = [];
        return new Promise((resolve, reject) => {
                    
            self.chain.forEach( async block => {
                if(block.address === address){


                    const data = await block.getBData()

                    stars.push(data)
                }
            })
        
            resolve(stars)
            
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        let self = this;
        let errorLog = [];
        return new Promise(async (resolve, reject) => {
            self.chain.forEach( async (block) => {
                
                // Check if block is valid
                let isValid = await block.validate()
                if(!isValid)(
                    errorLog.push(Error('Block ' + block.hash + ' is invalid'))
                )

                // Check if previousBlockHash is correct
                if(block.height > 0){
                    if(self.chain[block.height - 1].hash !== block.previousBlockHash){
                        errorLog.push(Error('Block ' + block.hash + ' has an invalid previous block hash'))
                    }
                }
            })

            resolve(errorLog)

        });
    }

}

module.exports.Blockchain = Blockchain;   