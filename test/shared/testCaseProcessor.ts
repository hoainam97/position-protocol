import {BEP20Mintable, FundingRateTest, PositionHouse, PositionHouseViewer} from "../../typeChain";
import fs from "fs";
import PositionHouseTestingTool from "./positionHouseTestingTool";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {BigNumber} from "ethers";
import {expect} from "chai";

export default class TestCaseProcessor {
    private readonly positionManager: FundingRateTest;
    private readonly positionHouse: PositionHouse;
    private readonly positionHouseViewer: PositionHouseViewer;
    private readonly phTT: PositionHouseTestingTool;
    private readonly bep20Mintable: BEP20Mintable

    private readonly traders: SignerWithAddress[];
    private readonly marketMakers: SignerWithAddress[];

    private checkPointBalance: BigNumber = BigNumber.from('0')

    constructor(positionManager: FundingRateTest,
                positionHouse: PositionHouse,
                positionHouseViewer: PositionHouseViewer,
                phTT: PositionHouseTestingTool,
                bep20Mintable: BEP20Mintable,
                trader0, trader1, trader2, trader3, trader4, marketMaker1, marketMaker2: SignerWithAddress) {
        this.positionManager = positionManager
        this.positionHouse = positionHouse
        this.positionHouseViewer = positionHouseViewer
        this.phTT = phTT
        this.bep20Mintable = bep20Mintable
        this.traders = [trader0, trader1, trader2, trader3, trader4]
        this.marketMakers = [marketMaker1, marketMaker2];
    }

    async process(filePath: string) {
        const data = JSON.parse(fs.readFileSync(filePath).toString())

        const balanceOfTargetTraderBeforeTestcase = await this.bep20Mintable.balanceOf(this.traders[data.targetTrader].address)
        console.log(`balanceOfTargetTraderBeforeTestcase: ${balanceOfTargetTraderBeforeTestcase.toString()}`)

        for (const step of data.steps) {
            switch (step.action) {
                case "dumpPrice":
                    await this.processDumpPrice(step)
                    break
                case "pumpPrice":
                    await this.processPumpPrice(step)
                    break
                case "openLimit":
                    await this.processOpenLimit(step)
                    break
                case "openMarket":
                    await this.processOpenMarket(step)
                    break
                case "setMockPrice":
                    await this.processSetMockPrice(step)
                    break
                case "addMargin":
                    await this.processAddMargin(step)
                    break
                case "removeMargin":
                    await this.processRemoveMargin(step)
                    break
                case "getAddedMargin":
                    await this.processGetAddedMargin(step)
                    break
                case "claimFund":
                    await this.processClaimFund(step)
                    break
                case "payFunding":
                    await this.processPayFunding(step)
                    break
                case "assertTotalReceived":
                    await this.processAssertTotalReceived(step, this.traders[data.targetTrader], balanceOfTargetTraderBeforeTestcase)
                    break
                case "assertMargin":
                    await this.processAssertMargin(step, this.traders[data.targetTrader])
                    break
                case "assertEntry":
                    await this.processAssertEntry(step, this.traders[data.targetTrader])
                    break
                case "setBalanceCheckPoint":
                    await this.setBalanceCheckPoint(step, this.traders[data.targetTrader])
                    break
                case "assertCurrentBalanceWithCheckPoint":
                    await this.assertCurrentBalanceWithCheckPoint(step, this.traders[data.targetTrader])
                    break
            }
        }
    }

    async processDumpPrice(step: any) {
        const {price} = step
        await this.phTT.dumpPrice({
            toPrice: price,
            pumper: this.marketMakers[0],
            pumper2: this.marketMakers[1],
            positionManager: this.positionManager
        })
        const currentPip = await this.positionManager.getCurrentPip()
        console.log(`DumpPrice to ${price}. Current pip is ${currentPip.toString()}`)
    }

    async processPumpPrice(step: any) {
        const {price} = step
        await this.phTT.pumpPrice({
            toPrice: price,
            pumper: this.marketMakers[0],
            pumper2: this.marketMakers[1],
            positionManager: this.positionManager
        })
        const currentPip = await this.positionManager.getCurrentPip()
        console.log(`PumpPrice to ${price}. Current pip is ${currentPip.toString()}`)
    }

    async processOpenLimit(step: any) {
        const {price, side, leverage = 10, quantity, trader} = step
        await this.phTT.openLimitPositionAndExpect({
            limitPrice: price,
            side: side,
            leverage: leverage,
            quantity: BigNumber.from(quantity),
            _trader: this.traders[trader],
            _positionManager: this.positionManager,
            skipCheckBalance: true
        })
        console.log(`OpenLimit: price [${price}], side [${side}], leverage [${leverage}], quantity [${quantity}], trader [${trader}]`)
    }

    async processOpenMarket(step: any) {
        const {quantity, leverage = 10, side, trader} = step
        await this.phTT.openMarketPosition({
            quantity: BigNumber.from(quantity),
            leverage: leverage,
            side: side,
            trader: this.traders[trader].address,
            instanceTrader: this.traders[trader],
            _positionManager: this.positionManager,
        })
        console.log(`OpenMarket: quantity [${quantity}], leverage [${leverage}], side [${side}], trader [${trader}]`)
    }

    async processSetMockPrice(step: any) {
        const {price} = step
        await this.positionManager.setMockPrice(BigNumber.from(price), BigNumber.from(price))
        console.log(`SetMockPrice: price [${price}]`)
    }

    async processAddMargin(step: any) {
        const {trader, amount} = step
        await this.positionHouse.connect(this.traders[trader]).addMargin(this.positionManager.address, BigNumber.from(amount))
        console.log(`AddMargin: trader [${trader}], amount [${amount}]`)

        await this.processGetAddedMargin(step)
    }

    async processRemoveMargin(step: any) {
        const {trader, amount} = step
        await this.positionHouse.connect(this.traders[trader]).removeMargin(this.positionManager.address, BigNumber.from(amount))
        console.log(`RemoveMargin: trader [${trader}], amount [${amount}]`)

        await this.processGetAddedMargin(step)
    }

    async processGetAddedMargin(step: any) {
        const {trader} = step

        const totalAddedMargin = await this.positionHouseViewer.getAddedMargin(this.positionManager.address, this.traders[trader].address)
        console.log(`Total added margin: trader [${trader}], amount [${totalAddedMargin}]`)
    }

    async processClaimFund(step: any) {
        const {trader} = step

        const claimAmount = await this.positionHouseViewer.getClaimAmount(this.positionManager.address, this.traders[trader].address)
        await this.positionHouse.connect(this.traders[trader]).claimFund(this.positionManager.address)
        console.log(`ClaimFund: trader [${trader}], claimAmount [${claimAmount.toString()}]`)
    }

    async processAssertTotalReceived(step: any, targetTrader: SignerWithAddress, balanceOfTargetTraderBeforeTestcase: BigNumber) {
        const balanceOfTargetTraderAfterTestcase = await this.bep20Mintable.balanceOf(targetTrader.address)
        const exchangedQuoteAmount = BigNumber.from(balanceOfTargetTraderAfterTestcase).sub(BigNumber.from(balanceOfTargetTraderBeforeTestcase))
        console.log(`AssertTotalReceived: actual ${exchangedQuoteAmount}. expected ${step.value}`)
        expect(exchangedQuoteAmount).eq(step.value)
    }

    async processAssertMargin(step: any, targetTrader: SignerWithAddress) {
        const position = await this.positionHouse.getPosition(this.positionManager.address, targetTrader.address)
        expect(position.margin).eq(step.value)
    }

    async processAssertEntry(step: any, targetTrader: SignerWithAddress) {
        const position = await this.positionHouse.getPosition(this.positionManager.address, targetTrader.address)
        const entry = position.openNotional.div(position.quantity).toNumber().toFixed(3)
        console.log(`Entry: ${entry} Step value: ${step.value}`)
        expect(entry == step.value).true
    }

    async processPayFunding(step: any) {
        await this.positionHouse.connect(this.marketMakers[0]).payFunding(this.positionManager.address)
        console.log(`Funding Paid`)
    }

    async setBalanceCheckPoint(step: any, targetTrader: SignerWithAddress) {
        this.checkPointBalance = await this.bep20Mintable.balanceOf(targetTrader.address)
        console.log(`SetBalanceCheckPoint for target trader to ${this.checkPointBalance.toString()}`)
    }

    async assertCurrentBalanceWithCheckPoint(step: any, targetTrader: SignerWithAddress) {
        const currentBalance = await this.bep20Mintable.balanceOf(targetTrader.address)
        console.log(`AssertCurrentBalanceWithCheckPoint current balance of target trader is ${currentBalance.toString()}`)
        expect(currentBalance.sub(this.checkPointBalance).toNumber()).eq(step.value)
    }
}