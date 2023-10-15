import {Blockchain, SandboxContract} from '@ton-community/sandbox';
import {Address, beginCell, toNano} from 'ton-core';
import {Task3} from '../wrappers/Task3';
import '@ton-community/test-utils';
import {Add} from '../build/Task1/tact_Task1';

describe('Task3', () => {
	let blockchain: Blockchain;
	let task3: SandboxContract<Task3>;
	let tokenA: Address;
	let tokenB: Address;
	let admin: Address;

	beforeEach(async () => {
		blockchain = await Blockchain.create();

		tokenA = Address.parse('EQCnEWNHi38OLtH1lMTvVW7KJSMneSKdGF9GsEODBt21tmyU');
		tokenB = Address.parse('EQAgJdyanQfEsQRW0L1Zded0PgwTEMv9vBujaGJ-PTKbKwQj');
		admin = Address.parse('EQD1X7wifAbsq5C_hry1R_OdW2mx0RqXy1uuRonqNMQsd-9j');

		task3 = blockchain.openContract(await Task3.fromInit(admin, tokenA, tokenB));
		const deployer = await blockchain.treasury('deployer');
		const deployResult = await task3.send(
			deployer.getSender(),
			{
				value: toNano('0.05'),
			},
			{
				$$type: 'Deploy',
				queryId: 0n,
			}
		);
		expect(deployResult.transactions).toHaveTransaction({
			from: deployer.address,
			to: task3.address,
			deploy: true,
			success: true,
		});
	});

	const tokenTransfer = async (amount: bigint, dest: Address) => {
		const deployer = await blockchain.treasury('deployer');
		await task3.send(
			deployer.getSender(),
			{
				value: toNano('0.05'),
			},
			{
				$$type: 'TokenTransfer',
				queryId: 0n,

				amount: amount * 1000000000n,
				destination: dest,
				responseDestination: null,
				customPayload: null,
				forwardTonAmount: toNano('0.05'),
				forwardPayload: beginCell().endCell(),

			}
		);
	};

	it('receive a balance', async () => {
		expect(await task3.getBalance(tokenA)).toBe(0n);
	});

	it('зачисление на счет', async () => {
		await tokenTransfer(10n, tokenA);

		expect(await task3.getBalance(tokenA)).toBe(10n * 1000000000n);
	});
});


