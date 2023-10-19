import { Blockchain, SandboxContract, SendMessageResult } from '@ton-community/sandbox';
import { Address, beginCell, toNano } from 'ton-core';
import { Task3 } from '../wrappers/Task3';
import '@ton-community/test-utils';
import {gasCompare} from '../util/gas-usage';

describe('Task3', () => {
	let blockchain: Blockchain;
	let task3: SandboxContract<Task3>;
	let tokenA: Address;
	let tokenB: Address;
	let admin: Address;
	let from: Address;

	beforeEach(async () => {
		blockchain = await Blockchain.create();

		const addresses = await blockchain.createWallets(4);

		tokenA = addresses[0].getSender().address;
		tokenB = addresses[1].getSender().address;
		admin = addresses[2].getSender().address;
		from = addresses[3].getSender().address;

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

	const tokenTransfer = async (token: 'A' | 'B', amount: bigint, from: Address): Promise<SendMessageResult> => {
		const sender = token === 'A' ? blockchain.sender(tokenA) : blockchain.sender(tokenB);
		return await task3.send(
			sender,
			{
				value: toNano('1'),
			},
			{
				$$type: 'TokenNotification',
				queryId: 0n,
				amount,
				from,
				forwardPayload: beginCell().endCell(),
			}
		);
	};

	it('receive a balance', async () => {
		expect(await task3.getBalance(tokenA)).toBe(0n);
	});

	it('зачисление на счет A', async () => {
		const r = await tokenTransfer('A', 10n, admin);

		expect(await task3.getBalance(tokenA)).toBe(10n);

		gasCompare(r, 7891000n);
	});

	it('зачисление на счет B', async () => {
		const r = await tokenTransfer('B', 2n, admin);

		expect(await task3.getBalance(tokenB)).toBe(2n);

		gasCompare(r, 8005000n);
	});

	it('зачисление на счет B от внешнего контракта', async () => {
		const r1 = await tokenTransfer('A', 10n, admin);
		const r2 = await tokenTransfer('B', 2n, admin);

		const r3 = await tokenTransfer('B', 1n, from);

		expect(await task3.getBalance(tokenB)).toBe(3n);
		expect(await task3.getBalance(tokenA)).toBe(5n);

		gasCompare(r1, 7891000n);
		gasCompare(r2, 8005000n);
		gasCompare(r3, 15723324n);
	});

	it('зачисление на счет A от внешнего контракта', async () => {
		const r1 = await tokenTransfer('A', 10n, admin);
		const r2 = await tokenTransfer('B', 2n, admin);

		const t = await tokenTransfer('A', 10n, from);

		expect(await task3.getBalance(tokenA)).toBe(20n);
		expect(await task3.getBalance(tokenB)).toBe(0n);

		expect(t.transactions).toHaveTransaction({
			from: expect.any,
			to: tokenB,
			deploy: false,
			success: true,
		});

		gasCompare(r1, 7891000n);
		gasCompare(r2, 8005000n);
		gasCompare(t, 15444324n);
	});

	it('зачисление при нехватке средств', async () => {
		const t = await tokenTransfer('A', 10n, from);

		expect(await task3.getBalance(tokenA)).toBe(0n);
		expect(await task3.getBalance(tokenB)).toBe(0n);

		expect(t.transactions).toHaveTransaction({
			from: expect.any,
			to: tokenA,
			deploy: false,
			success: true,
		});
	});

	it('получение цены', async () => {
		await tokenTransfer('A', 10n, admin);
		await tokenTransfer('B', 2n, admin);

		expect(await task3.getPrice(tokenA)).toBe(200000000n);
		expect(await task3.getPrice(tokenB)).toBe(5000000000n);
	});
});
