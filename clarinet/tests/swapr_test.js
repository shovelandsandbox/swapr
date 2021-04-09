// import { Clarinet, Tx, types } from 'https://deno.land/x/clarinet@v0.4.0/index.ts'
import { Clarinet, Tx, types } from './clarinet.ts'
import { assertEquals, assertExists } from 'https://deno.land/std@0.90.0/testing/asserts.ts'
import { unwrapList, unwrapOK, unwrapTuple, unwrapUInt, parse } from './utils.js'

Clarinet.test({
  name: "Ensure that <...> - swapr",
  async fn(chain, accounts) {
    let block = chain.mineBlock([

      Tx.contractCall('swapr', 'create-pair', [
        types.principal('ST000000000000000000002AMW42H.plaid-token'),
        types.principal('ST000000000000000000002AMW42H.stx-token'),
        types.principal('ST000000000000000000002AMW42H.plaid-stx-token'),
        types.ascii('plaid-stx-token'),
        types.uint(10000000),
        types.uint(15000000),
      ], accounts[0].address),

    ])
    assertEquals(block.receipts.length, 1)
    assertEquals(block.height, 2)

    block.receipts[0].result.expectOk().expectBool(true);

    const result_get_pair_count = chain.callReadOnlyFn('swapr', 'get-pair-count', [], accounts[0].address).result
    const count = result_get_pair_count.expectOk().expectUint(1)

    const result_get_pair_contracts = chain.callReadOnlyFn('swapr', 'get-pair-contracts', [types.uint(1)], accounts[0].address).result
    const pair1 = result_get_pair_contracts.expectTuple()

    pair1['token-x'].expectPrincipal('ST000000000000000000002AMW42H.plaid-token')
    pair1['token-y'].expectPrincipal('ST000000000000000000002AMW42H.stx-token')

    const result_get_pair_details = chain.callReadOnlyFn('swapr', 'get-pair-details', [types.principal(pair1['token-x']), types.principal(pair1['token-y'])], accounts[0].address).result
    const pair1_details = result_get_pair_details.expectTuple()

    pair1_details['balance-x'].expectUint(10000000)
    pair1_details['balance-y'].expectUint(15000000)
    pair1_details['fee-balance-x'].expectUint(0)
    pair1_details['fee-balance-y'].expectUint(0)
    pair1_details['fee-to-address'].expectNone()
    pair1_details.name.expectAscii('plaid-stx-token')
    pair1_details['shares-total'].expectUint(12247448)
    pair1_details['swapr-token'].expectPrincipal('ST000000000000000000002AMW42H.plaid-stx-token')


    const result_pair1_get_balances = chain.callReadOnlyFn('swapr', 'get-balances', [types.principal(pair1['token-x']), types.principal(pair1['token-y'])], accounts[0].address).result
    const pair1_balances = result_pair1_get_balances.expectOk().expectList()
    pair1_balances[0].expectUint(10000000)
    pair1_balances[1].expectUint(15000000)

    const result_stx_token_balance_1 = chain.callReadOnlyFn('stx-token', 'get-balance-of', [types.principal(accounts[0].address)], accounts[0].address).result
    const stx_token_balance_1 = result_stx_token_balance_1.expectOk().expectUint(999985000000)

    const result_plaid_token_balance_1 = chain.callReadOnlyFn('plaid-token', 'get-balance-of', [types.principal(accounts[0].address)], accounts[0].address).result
    const plaid_token_balance_1 = result_plaid_token_balance_1.expectOk().expectUint(999990000000)

    block = chain.mineBlock([

      // swap-x-for-y (token-x-trait <src20-token>) (token-y-trait <src20-token>) (dx uint) (min-dy uint)
      Tx.contractCall('swapr', 'swap-x-for-y', [
        types.principal('ST000000000000000000002AMW42H.plaid-token'),
        types.principal('ST000000000000000000002AMW42H.stx-token'),
        types.uint(10000),
        types.uint(6600),  // with 1.5 exchange rate, would get 6642 with fee
      ], accounts[0].address),

    ])
    assertEquals(block.receipts.length, 1)
    assertEquals(block.height, 3)

    const swap_result = block.receipts[0].result.expectOk().expectList();
    swap_result[0].expectUint(10000)
    swap_result[1].expectUint(6642)

    const result_pair1_get_balances_2 = chain.callReadOnlyFn('swapr', 'get-balances', [types.principal(pair1['token-x']), types.principal(pair1['token-y'])], accounts[0].address).result
    const pair1_balances_2 = result_pair1_get_balances_2.expectOk().expectList()
    pair1_balances_2[0].expectUint(10010000)
    pair1_balances_2[1].expectUint(14993358)

    const result_stx_token_balance_2 = chain.callReadOnlyFn('stx-token', 'get-balance-of', [types.principal(accounts[0].address)], accounts[0].address).result
    const plaid_balance_2 = result_stx_token_balance_2.expectOk().expectUint(999985006642)
    const result_plaid_token_balance_2 = chain.callReadOnlyFn('plaid-token', 'get-balance-of', [types.principal(accounts[0].address)], accounts[0].address).result
    const stx_balance_2 = result_plaid_token_balance_2.expectOk().expectUint(999989990000)

    assertEquals(plaid_balance_2 - plaid_token_balance_1, -4993358)
    assertEquals(stx_balance_2 - stx_token_balance_1, 4990000)

  },
})
