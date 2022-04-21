import { task } from "hardhat/config";
import path = require("path");
import {readdir} from "fs/promises";
import {ExecOptions} from "child_process";
import {MigrationContext, Network, Stage} from "../deploy/types";
import {ContractWrapperFactory} from "../deploy/ContractWrapperFactory";
import {DeployDataStore} from "../deploy/DataStore";
import {BUSD, BUSD_ADDRESS} from "../constants";


task('deploy', 'deploy contracts', async (taskArgs: {stage: Stage}, hre, runSuper) => {
    const basePath = path.join(__dirname, "../deploy/migrations")
    const filenames = await readdir(basePath)
    let filename
    if (taskArgs.stage == 'production'){
        filename = './deployData_mainnet.db'
    } else if (hre.network.name == "qc") {
        filename = './deployData_develop_qc.db'
    }
    const db = new DeployDataStore(filename)
    const context: MigrationContext = {
        stage: taskArgs.stage,
        network: hre.network.name as Network,
        factory: new ContractWrapperFactory(db, hre),
        db,
        hre
    }

    if (taskArgs.stage == 'production') {
        await db.saveAddressByKey(BUSD, BUSD_ADDRESS)
    }
    for (const filename of filenames) {
        console.info(`Start migration: ${filename}`)
        const module = await import(path.join(basePath, filename))
        const tasks = module.default.getTasks(context)
        for(const key of Object.keys(tasks)){
            console.group(`-- Start run task ${key}`)
            await tasks[key]()
            console.groupEnd()
        }

    }
}).addParam('stage', 'Stage')

task('listDeployedContract', 'list all deployed contracts', async () => {
    const db = new DeployDataStore()
    const data = await db.listAllContracts()
    for(const obj of data){
        console.log(obj.key, obj.address)
    }
})


export default {}