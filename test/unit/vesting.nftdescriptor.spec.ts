import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { assert, expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers, network } from 'hardhat';
import type {
  MockERC20,
  MockSVGElements,
  UnseenVesting,
  MockUnseenVestingNFTDescriptor,
} from '@typechained';
import type { UnseenFixtures } from '@utils/fixtures';
import type { ScheduleParams } from '@utils/types';
import type { BigNumberish, Wallet } from 'ethers';
import { randomHex } from '@utils/encoding';
import { faucet } from '@utils/faucet';
import { unseenFixture } from '@utils/fixtures';
import { deployContract as deploy } from '@utils/contracts';
import { clock, duration } from '@utils/time';
import { toBigNumber } from 'utils/helper-functions';

describe(`Vesting NFT Descriptor - (Unseen v${process.env.VERSION})`, async function () {
  const { provider } = ethers;

  let mockERC20: MockERC20;
  let unseenVesting: UnseenVesting;
  let vestingNFTDescriptorMock: MockUnseenVestingNFTDescriptor;
  let svgElementsMock: MockSVGElements;
  let schedules: ScheduleParams[];
  let mintAndApproveERC20: UnseenFixtures['mintAndApproveERC20'];

  after(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
    });
  });

  // Wallets
  let owner: Wallet;
  let bob: Wallet;
  let alice: Wallet;

  let amount: BigNumber;
  let timestamp: BigNumber;

  let char_width_large: number;
  let char_width_small: number;

  let DISCLAIMER: string;

  async function setupFixture() {
    owner = new ethers.Wallet(randomHex(32), provider);
    bob = new ethers.Wallet(randomHex(32), provider);
    alice = new ethers.Wallet(randomHex(32), provider);
    for (const wallet of [owner, bob, alice]) {
      await faucet(wallet.address, provider);
    }

    return {
      owner,
      bob,
      alice,
    };
  }

  before(async () => {
    ({ owner, bob, alice } = await loadFixture(setupFixture));
    DISCLAIMER =
      '⚠️ WARNING: Transferring the NFT makes the new owner the recipient of the schedule. The funds are not automatically withdrawn for the previous recipient.';
  });

  beforeEach(async function () {
    ({ mockERC20, mintAndApproveERC20, unseenVesting, schedules } =
      await unseenFixture(owner));

    timestamp = await clock.timestamp();

    char_width_large = 16;
    char_width_small = 13;

    vestingNFTDescriptorMock = await deploy(
      'MockUnseenVestingNFTDescriptor',
      owner
    );

    svgElementsMock = await deploy('MockSVGElements', owner);

    await unseenVesting.setNFTDescriptor(vestingNFTDescriptorMock.address);

    amount = parseEther('1000000000');

    /**
     * @note an equal amount of tokens should be approved to be spent
     *       by unseenVesting earlier to schedules creation
     */
    await mintAndApproveERC20(owner, unseenVesting.address, amount);

    expect(await mockERC20.balanceOf(owner.address)).to.eq(amount);

    expect(
      await mockERC20.allowance(owner.address, unseenVesting.address)
    ).to.eq(amount);

    // @note update sender address
    schedules.forEach((schedule) => {
      schedule.sender = owner.address;
    });
  });

  async function aa(amount: BigNumberish, decimals: number) {
    return vestingNFTDescriptorMock.abbreviateAmount_(amount, decimals);
  }

  async function ge(abbreviation: string) {
    const signGE = await svgElementsMock.getSignGE();
    return signGE.concat(' ', abbreviation);
  }

  async function cpw(text: string, largeFont: boolean) {
    return await vestingNFTDescriptorMock.calculatePixelWidth_(text, largeFont);
  }

  async function gn(vestingModal: string, scheduleId: string) {
    return await vestingNFTDescriptorMock.generateName_(
      vestingModal,
      scheduleId
    );
  }

  async function sp(percentage: number) {
    return await vestingNFTDescriptorMock.stringifyPercentage_(percentage);
  }

  async function sfa(amount: number) {
    return await vestingNFTDescriptorMock.stringifyFractionalAmount_(amount);
  }

  function dyn(scheduleId: string): string {
    return `UNSEEN-VESTING #${scheduleId}`;
  }

  function large(text: string): number {
    return text.length * char_width_large;
  }

  function small(text: string): number {
    return text.length * char_width_small;
  }

  context('abbreviate amount', function () {
    it('zero abbreviation amount', async function () {
      const expectedAbbreviation = '0';
      assert.equal(await aa(0, 0), expectedAbbreviation, 'abbreviation');
      assert.equal(await aa(0, 1), expectedAbbreviation, 'abbreviation');
      assert.equal(await aa(0, 2), expectedAbbreviation, 'abbreviation');
      assert.equal(await aa(0, 18), expectedAbbreviation, 'abbreviation');
    });
    it('tiny abbreviation amount', async function () {
      const signLT = await svgElementsMock.getSignLT();
      const expectedAbbreviation = signLT.concat(' 1');
      assert.equal(await aa(5, 1), expectedAbbreviation, 'abbreviation');
      assert.equal(await aa(9, 1), expectedAbbreviation, 'abbreviation');
      assert.equal(await aa(42, 2), expectedAbbreviation, 'abbreviation');
      assert.equal(await aa(99, 2), expectedAbbreviation, 'abbreviation');
      assert.equal(
        await aa(toBigNumber(1e17).sub(1), 18),
        expectedAbbreviation,
        'abbreviation'
      );
      assert.equal(
        await aa(toBigNumber(1e18).sub(1), 18),
        expectedAbbreviation,
        'abbreviation'
      );
    });
    it('zillions abbreviation amount', async function () {
      const signGT = await svgElementsMock.getSignGT();
      const expectedAbbreviation = signGT.concat(' 999.99T');
      assert.equal(
        await aa(toBigNumber(1e15), 0),
        expectedAbbreviation,
        'abbreviation'
      );
      assert.equal(
        await aa(toBigNumber(1e16), 1),
        expectedAbbreviation,
        'abbreviation'
      );
      assert.equal(
        await aa(toBigNumber(1e16).add(1), 1),
        expectedAbbreviation,
        'abbreviation'
      );
      assert.equal(
        await aa(toBigNumber(1e17), 2),
        expectedAbbreviation,
        'abbreviation'
      );
      assert.equal(
        await aa(toBigNumber(1e17).add(1), 2),
        expectedAbbreviation,
        'abbreviation'
      );
      assert.equal(
        await aa(toBigNumber(1e33), 18),
        expectedAbbreviation,
        'abbreviation'
      );
      assert.equal(
        await aa(toBigNumber(1e33).add(1), 18),
        expectedAbbreviation,
        'abbreviation'
      );
      assert.equal(
        await aa(ethers.constants.MaxUint256.shr(128).sub(1), 18),
        expectedAbbreviation,
        'abbreviation'
      );
    });
    it('no suffix abbreviation amount', async function () {
      assert.equal(await aa(1, 0), await ge('1'), 'abbreviation');
      assert.equal(await aa(5, 0), await ge('5'), 'abbreviation');
      assert.equal(await aa(121, 1), await ge('12'), 'abbreviation');
      assert.equal(await aa(1337, 2), await ge('13'), 'abbreviation');
      assert.equal(await aa(78_921, 2), await ge('789'), 'abbreviation');
      assert.equal(
        await aa(toBigNumber(988e18), 18),
        await ge('988'),
        'abbreviation'
      );
    });
    it('abbreviation amount thousands', async function () {
      assert.equal(await aa(1337, 0), await ge('1.33K'), 'abbreviation');
      assert.equal(await aa(1080, 0), await ge('1.08K'), 'abbreviation');
      assert.equal(await aa(1800, 0), await ge('1.80K'), 'abbreviation');
      assert.equal(await aa(37_184, 1), await ge('3.71K'), 'abbreviation');
      assert.equal(await aa(49_137, 1), await ge('4.91K'), 'abbreviation');
      assert.equal(await aa(600_555, 2), await ge('6K'), 'abbreviation');
      assert.equal(
        await aa(toBigNumber(8211e18), 18),
        await ge('8.21K'),
        'abbreviation'
      );
      assert.equal(
        await aa(toBigNumber(201_287e18), 18),
        await ge('201.28K'),
        'abbreviation'
      );
    });
    it('abbreviation amount millions', async function () {
      assert.equal(await aa(1_337_081, 0), await ge('1.33M'), 'abbreviation');
      assert.equal(await aa(2_194_000, 0), await ge('2.19M'), 'abbreviation');
      assert.equal(await aa(30_448_842, 1), await ge('3.04M'), 'abbreviation');
      assert.equal(await aa(50_077_231, 1), await ge('5M'), 'abbreviation');
      assert.equal(await aa(681_408_920, 2), await ge('6.81M'), 'abbreviation');
      assert.equal(
        await aa(toBigNumber(8_882_108e18), 18),
        await ge('8.88M'),
        'abbreviation'
      );
      assert.equal(
        await aa(toBigNumber(577_308_003e18), 18),
        await ge('577.30M'),
        'abbreviation'
      );
    });
    it('abbreviation amount billions', async function () {
      assert.equal(
        await aa(1_337_081_132, 0),
        await ge('1.33B'),
        'abbreviation'
      );
      assert.equal(
        await aa(2_763_455_030, 0),
        await ge('2.76B'),
        'abbreviation'
      );
      assert.equal(await aa(30_008_011_215, 1), await ge('3B'), 'abbreviation');
      assert.equal(
        await aa(50_450_772_867, 1),
        await ge('5.04B'),
        'abbreviation'
      );
      assert.equal(
        await aa(734_730_810_730, 2),
        await ge('7.34B'),
        'abbreviation'
      );
      assert.equal(
        await aa(toBigNumber(9_927_800_422e18), 18),
        await ge('9.92B'),
        'abbreviation'
      );
      assert.equal(
        await aa(toBigNumber(699_881_672_021e18), 18),
        await ge('699.88B'),
        'abbreviation'
      );
    });
    it('abbreviation amount trillions', async function () {
      assert.equal(
        await aa(2_578_924_152_034, 0),
        await ge('2.57T'),
        'abbreviation'
      );
      assert.equal(
        await aa(3_931_548_209_201, 0),
        await ge('3.93T'),
        'abbreviation'
      );
      assert.equal(
        await aa(60_008_233_054_613, 1),
        await ge('6T'),
        'abbreviation'
      );
      assert.equal(
        await aa(61_236_342_018_965, 1),
        await ge('6.12T'),
        'abbreviation'
      );
      assert.equal(
        await aa(734_730_810_730_992, 2),
        await ge('7.34T'),
        'abbreviation'
      );
      assert.equal(
        await aa(toBigNumber(9_621_312_102_753e18), 18),
        await ge('9.62T'),
        'abbreviation'
      );
      assert.equal(
        await aa(toBigNumber(101_076_479_280_188e18), 18),
        await ge('101.07T'),
        'abbreviation'
      );
    });
  });
  context('duration calculation in days', function () {
    it('zero', async function () {
      const signLT = await svgElementsMock.getSignLT();
      const expectedDurationInDays = signLT.concat(' 1 Day');
      const endTime = timestamp.add(duration.days(1).sub(1));
      const actualDurationInDays =
        await vestingNFTDescriptorMock.calculateDurationInDays_(
          timestamp,
          endTime
        );
      expect(actualDurationInDays).to.eq(expectedDurationInDays);
    });
    it('one', async function () {
      const endTime = timestamp.add(duration.days(1));
      const actualDurationInDays =
        await vestingNFTDescriptorMock.calculateDurationInDays_(
          timestamp,
          endTime
        );
      const expectedDurationInDays = '1 Day';
      expect(actualDurationInDays).to.eq(expectedDurationInDays);
    });
    it('forty two', async function () {
      const endTime = timestamp.add(duration.days(42));
      const actualDurationInDays =
        await vestingNFTDescriptorMock.calculateDurationInDays_(
          timestamp,
          endTime
        );
      const expectedDurationInDays = '42 Days';
      expect(actualDurationInDays).to.eq(expectedDurationInDays);
    });
    it('leet', async function () {
      const endTime = timestamp.add(duration.days(1337));
      const actualDurationInDays =
        await vestingNFTDescriptorMock.calculateDurationInDays_(
          timestamp,
          endTime
        );
      const expectedDurationInDays = '1337 Days';
      expect(actualDurationInDays).to.eq(expectedDurationInDays);
    });
    it('ten thousand', async function () {
      const signGT = await svgElementsMock.getSignGT();
      const expectedDurationInDays = signGT.concat(' 9999 Days');
      const endTime = timestamp.add(duration.days(10_000));
      const actualDurationInDays =
        await vestingNFTDescriptorMock.calculateDurationInDays_(
          timestamp,
          endTime
        );
      expect(actualDurationInDays).to.eq(expectedDurationInDays);
    });
    it('overflow', async function () {
      const signGT = await svgElementsMock.getSignGT();
      const expectedDurationInDays = signGT.concat(' 9999 Days');
      const endTime = timestamp.sub(1);
      const actualDurationInDays =
        await vestingNFTDescriptorMock.calculateDurationInDays_(
          timestamp,
          endTime
        );
      expect(actualDurationInDays).to.eq(expectedDurationInDays);
    });
  });
  context('pixel width calculation', function () {
    it('should calculate pixel width for empty string', async function () {
      const actualWidth = await cpw('', false);
      const expectedWidth = 0;
      expect(actualWidth).to.equal(expectedWidth, 'width');
    });
    it('should calculate pixel width for captions', async function () {
      const largeFont = false;
      expect(await cpw('Progress', largeFont)).to.equal(
        small('Progress'),
        'pixel width'
      );
      expect(await cpw('Status', largeFont)).to.equal(
        small('Status'),
        'pixel width'
      );
      expect(await cpw('Vested', largeFont)).to.equal(
        small('Vested'),
        'pixel width'
      );
      expect(await cpw('Duration', largeFont)).to.equal(
        small('Duration'),
        'pixel width'
      );
    });

    it('should calculate pixel width for progress', async function () {
      const largeFont = true;
      expect(await cpw('0%', largeFont)).to.equal(large('0%'), 'pixel width');
      expect(await cpw('0.01%', largeFont)).to.equal(
        large('0.01%'),
        'pixel width'
      );
      expect(await cpw('0.42%', largeFont)).to.equal(
        large('0.42%'),
        'pixel width'
      );
      expect(await cpw('1%', largeFont)).to.equal(large('1%'), 'pixel width');
      expect(await cpw('3.14%', largeFont)).to.equal(
        large('3.14%'),
        'pixel width'
      );
      expect(await cpw('20.64%', largeFont)).to.equal(
        large('20.64%'),
        'pixel width'
      );
      expect(await cpw('99.99%', largeFont)).to.equal(
        large('99.99%'),
        'pixel width'
      );
      expect(await cpw('100%', largeFont)).to.equal(
        large('100%'),
        'pixel width'
      );
    });

    it('should calculate pixel width for status', async function () {
      const largeFont = true;
      expect(await cpw('Depleted', largeFont)).to.equal(
        large('Depleted'),
        'pixel width'
      );
      expect(await cpw('Canceled', largeFont)).to.equal(
        large('Canceled'),
        'pixel width'
      );
      expect(await cpw('Vesting', largeFont)).to.equal(
        large('Vesting'),
        'pixel width'
      );
      expect(await cpw('Settled', largeFont)).to.equal(
        large('Settled'),
        'pixel width'
      );
      expect(await cpw('Pending', largeFont)).to.equal(
        large('Pending'),
        'pixel width'
      );
    });

    it('should calculate pixel width for vested', async function () {
      const largeFont = true;
      expect(await cpw('&lt; 1', largeFont)).to.equal(
        large('< 1'),
        'pixel width'
      );
      expect(await cpw('&#8805; 42.73K', largeFont)).to.equal(
        large(' 42.73K') + char_width_large,
        'pixel width'
      );
      expect(await cpw('&#8805; 1.23M', largeFont)).to.equal(
        large(' 1.23M') + char_width_large,
        'pixel width'
      );
      expect(await cpw('&#8805; 8.10B', largeFont)).to.equal(
        large(' 8.10B') + char_width_large,
        'pixel width'
      );
      expect(await cpw('&#8805; 4.91T', largeFont)).to.equal(
        large(' 4.91T') + char_width_large,
        'pixel width'
      );
      expect(await cpw('&#8805; 999.99T', largeFont)).to.equal(
        large(' 999.99T') + char_width_large,
        'pixel width'
      );
    });

    it('should calculate pixel width for duration', async function () {
      const largeFont = true;
      expect(await cpw('&lt; 1 Day', largeFont)).to.equal(
        large('< 1 Day'),
        'pixel width'
      );
      expect(await cpw('1 Day', largeFont)).to.equal(
        large('1 Day'),
        'pixel width'
      );
      expect(await cpw('1337 Days', largeFont)).to.equal(
        large('1337 Days'),
        'pixel width'
      );
      expect(await cpw('9999 Days', largeFont)).to.equal(
        large('9999 Days'),
        'pixel width'
      );
      expect(await cpw('&gt; 9999 Days', largeFont)).to.equal(
        large('> 9999 Days'),
        'pixel width'
      );
    });
  });
  context('vested percentage calculation', function () {
    it('should calculate vested percentage for zero vesting amount', async function () {
      const actualVestedPercentage =
        await vestingNFTDescriptorMock.calculateVestedPercentage_(
          0,
          ethers.utils.parseEther('1337')
        );
      const expectedVestedPercentage = 0;
      expect(actualVestedPercentage).to.equal(
        expectedVestedPercentage,
        'vestedPercentage'
      );
    });

    it('should calculate vested percentage for vesting amount', async function () {
      const actualVestedPercentage =
        await vestingNFTDescriptorMock.calculateVestedPercentage_(
          ethers.utils.parseEther('100'),
          ethers.utils.parseEther('400')
        );
      const expectedVestedPercentage = 2500;
      expect(actualVestedPercentage).to.equal(
        expectedVestedPercentage,
        'vestedPercentage'
      );
    });

    it('should calculate vested percentage for settled amount', async function () {
      const actualVestedPercentage =
        await vestingNFTDescriptorMock.calculateVestedPercentage_(
          ethers.utils.parseEther('1337'),
          ethers.utils.parseEther('1337')
        );
      const expectedVestedPercentage = 10000;
      expect(actualVestedPercentage).to.equal(
        expectedVestedPercentage,
        'vestedPercentage'
      );
    });
  });
  context('description generation', function () {
    it('should generate description for empty input', async function () {
      const actualDescription =
        await vestingNFTDescriptorMock.generateDescription_('', '', '', '', '');
      const expectedDescription = [
        'This NFT represents a vesting schedule in Unseen Vesting contract.',
        ' The owner of this NFT can withdraw the vested uncn tokens, which are denominated in ',
        '.\\n\\n',
        '- Schedule ID: ',
        '\\n- ',
        ' Address: ',
        '\\n- ',
        ' Address: ',
        '\\n\\n',
        DISCLAIMER,
      ].join('');
      expect(actualDescription).to.equal(
        expectedDescription,
        'metadata description'
      );
    });

    it('should generate description for provided input', async function () {
      const symbol = 'UNCN';
      const actualDescription =
        await vestingNFTDescriptorMock.generateDescription_(
          'UNCN-VESTING',
          symbol,
          '42',
          '0x78B190C1E493752f85E02b00a0C98851A5638A30',
          '0xFEbD67A34821d1607a57DD31aae5f246D7dE2ca2'
        );
      const expectedDescription = [
        'This NFT represents a vesting schedule in Unseen Vesting contract.',
        ' The owner of this NFT can withdraw the vested uncn tokens, which are denominated in ',
        symbol,
        '.\\n\\n',
        '- Schedule ID: ',
        '42',
        '\\n- ',
        'UNCN-VESTING',
        ' Address: ',
        '0x78B190C1E493752f85E02b00a0C98851A5638A30',
        '\\n- ',
        symbol,
        ' Address: ',
        '0xFEbD67A34821d1607a57DD31aae5f246D7dE2ca2',
        '\\n\\n',
        DISCLAIMER,
      ].join('');
      expect(actualDescription).to.equal(
        expectedDescription,
        'metadata description'
      );
    });
  });
  context('attributes generation', function () {
    it('should generate attributes for empty input', async function () {
      const actualAttributes =
        await vestingNFTDescriptorMock.generateAttributes_('', '', '');
      const expectedAttributes = JSON.stringify([
        { trait_type: 'Token', value: '' },
        { trait_type: 'Sender', value: '' },
        { trait_type: 'Status', value: '' },
      ]);
      expect(actualAttributes).to.equal(
        expectedAttributes,
        'metadata attributes'
      );
    });

    it('should generate attributes for provided input', async function () {
      const actualAttributes =
        await vestingNFTDescriptorMock.generateAttributes_(
          'UNCN',
          '0x50725493D337CdC4e381f658e10d29d128BD6927',
          'Vesting'
        );
      const expectedAttributes = JSON.stringify([
        { trait_type: 'Token', value: 'UNCN' },
        {
          trait_type: 'Sender',
          value: '0x50725493D337CdC4e381f658e10d29d128BD6927',
        },
        { trait_type: 'Status', value: 'Vesting' },
      ]);
      expect(actualAttributes).to.equal(
        expectedAttributes,
        'metadata attributes'
      );
    });
  });
  context('name generation', function () {
    it('should generate name for empty input', async function () {
      expect(await gn('', '')).to.equal(' #', 'metadata name');
      expect(await gn('A', '')).to.equal('A #', 'metadata name');
      expect(await gn('', '1')).to.equal(' #1', 'metadata name');
    });

    it('should generate name for UNSEEN-VESTING model', async function () {
      expect(await gn('UNSEEN-VESTING', '1')).to.equal(
        dyn('1'),
        'metadata name'
      );
      expect(await gn('UNSEEN-VESTING', '42')).to.equal(
        dyn('42'),
        'metadata name'
      );
      expect(await gn('UNSEEN-VESTING', '1337')).to.equal(
        dyn('1337'),
        'metadata name'
      );
      expect(await gn('UNSEEN-VESTING', '1234567')).to.equal(
        dyn('1234567'),
        'metadata name'
      );
      expect(await gn('UNSEEN-VESTING', '123456890')).to.equal(
        dyn('123456890'),
        'metadata name'
      );
    });
  });
  context('svg generation', function () {
    it('pending schedule svg', async function () {
      const actualSVG = await vestingNFTDescriptorMock.generateSVG_({
        accentColor: 'hsl(155,18%,30%)',
        amount: '100',
        uncnAddress: '0x03a6a84cd762d9707a21605b548aaab891562aab',
        uncnSymbol: 'UNCN',
        duration: '5 Days',
        progress: '0%',
        progressNumerical: 0,
        unseenVestingAddress: '0xf3a045dc986015be9ae43bb3462ae5981b0816e0',
        status: 'Pending',
        vestingModel: 'UNCN-VESTING',
      });

      const expectedSVG =
        '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000"><rect width="100%" height="100%" filter="url(#Noise)"/><rect x="70" y="70" width="860" height="860" fill="#fff" fill-opacity=".03" rx="45" ry="45" stroke="#fff" stroke-opacity=".1" stroke-width="4"/><defs><filter id="Noise"><feFlood x="0" y="0" width="100%" height="100%" flood-color="hsl(230,21%,11%)" flood-opacity="1" result="floodFill"/><feTurbulence baseFrequency=".4" numOctaves="3" result="Noise" type="fractalNoise"/><feBlend in="Noise" in2="floodFill" mode="soft-light"/></filter><path d="M180.637,46.426V57.751a32.284,32.284,0,0,0-6.1-8.652,32.764,32.764,0,0,0-23.549-9.678,36.5,36.5,0,0,0-3.707.19l-45.607,4.663L73.267,40.4c-13.463-1.836-25.4,3.51-32.306,13.1-.063.1-.141.2-.2.3A35.921,35.921,0,0,0,34.7,73.731a42.58,42.58,0,0,0,3.046,16.136,45.286,45.286,0,0,0,1.99,4.375,46.717,46.717,0,0,0,3.01,5.022c.281.408.563.816.865,1.21a48.117,48.117,0,0,0,3.883,4.671L74.6,108.8l14.932,2.019v-.035c.324.063.655.12.985.169a13.708,13.708,0,0,0,2.321.119h.05a13.821,13.821,0,0,0,1.435-.134,11.722,11.722,0,0,0,9.657-8.222,13.282,13.282,0,0,0,.577-3.8,13.791,13.791,0,0,0-4.938-11.936l3.531-.373,30.048-3.172a31.69,31.69,0,0,1,5.838,7.153,34.057,34.057,0,0,1,4.656,17.458c0,.711-.021,1.428-.063,2.138a40.767,40.767,0,0,1-5.592,18.238c-6.457,10.67-17.282,17.824-28.965,19.139a48.088,48.088,0,0,1-11.8-.123L33.5,138.885C14.774,136.374-.25,119.134,0,100.495l1.076-78.6C1.27,8,12.791-1.678,26.809.243L155.435,17.891c13.92,1.913,25.2,14.672,25.2,28.536" transform="translate(0 0)" fill="#fff" opacity="0.4"/><path id="Path_4897" data-name="Path 4897" d="M183.595,162.276v78.49c0,13.969-11.134,26.588-24.9,28.184L30.069,283.861C15.9,285.507,4.382,275.315,4.382,261.093v-28.5c6.823,10.994,19.518,17.479,33.98,15.854l67.742-7.625,6.316-.71a39.714,39.714,0,0,0,10.8-2.806A44.378,44.378,0,0,0,143.973,219.3a45.756,45.756,0,0,0,3.616-7.758,42.829,42.829,0,0,0,2.525-14.4,37.315,37.315,0,0,0-5.149-19.237,33.857,33.857,0,0,0-2.975-4.256,34.2,34.2,0,0,0-4.424-4.488c-.1-.077-.183-.162-.289-.239L96.13,173.27a12.346,12.346,0,0,0-1.343.077,14.371,14.371,0,0,0-3.672.886,16.157,16.157,0,0,0-9.664,10.677,14.95,14.95,0,0,0-.527,3.89,12.978,12.978,0,0,0,1.554,6.26l-30.316-4.094a44.212,44.212,0,0,1-6.386-9.235,38.952,38.952,0,0,1-1.639-3.538c-.021-.443-.028-.886-.028-1.329a38.115,38.115,0,0,1,5.022-18.689c5.838-9.988,16.206-17.31,27.973-18.506l27.474-2.806,14.68-1.505,31.335-3.2c18.253-1.864,33,11.626,33,30.118" transform="translate(-2.958 -89.093)" fill="#fff" opacity="0.4"/><path id="FloatingText" fill="none" d="M125 45h750s80 0 80 80v750s0 80 -80 80h-750s-80 0 -80 -80v-750s0 -80 80 -80"/><g id="Logo"><path d="M180.637,46.426V57.751a32.284,32.284,0,0,0-6.1-8.652,32.764,32.764,0,0,0-23.549-9.678,36.5,36.5,0,0,0-3.707.19l-45.607,4.663L73.267,40.4c-13.463-1.836-25.4,3.51-32.306,13.1-.063.1-.141.2-.2.3A35.921,35.921,0,0,0,34.7,73.731a42.58,42.58,0,0,0,3.046,16.136,45.286,45.286,0,0,0,1.99,4.375,46.717,46.717,0,0,0,3.01,5.022c.281.408.563.816.865,1.21a48.117,48.117,0,0,0,3.883,4.671L74.6,108.8l14.932,2.019v-.035c.324.063.655.12.985.169a13.708,13.708,0,0,0,2.321.119h.05a13.821,13.821,0,0,0,1.435-.134,11.722,11.722,0,0,0,9.657-8.222,13.282,13.282,0,0,0,.577-3.8,13.791,13.791,0,0,0-4.938-11.936l3.531-.373,30.048-3.172a31.69,31.69,0,0,1,5.838,7.153,34.057,34.057,0,0,1,4.656,17.458c0,.711-.021,1.428-.063,2.138a40.767,40.767,0,0,1-5.592,18.238c-6.457,10.67-17.282,17.824-28.965,19.139a48.088,48.088,0,0,1-11.8-.123L33.5,138.885C14.774,136.374-.25,119.134,0,100.495l1.076-78.6C1.27,8,12.791-1.678,26.809.243L155.435,17.891c13.92,1.913,25.2,14.672,25.2,28.536" transform="translate(0 0)" fill="#fff" opacity="0.4"/><path id="Path_4897" data-name="Path 4897" d="M183.595,162.276v78.49c0,13.969-11.134,26.588-24.9,28.184L30.069,283.861C15.9,285.507,4.382,275.315,4.382,261.093v-28.5c6.823,10.994,19.518,17.479,33.98,15.854l67.742-7.625,6.316-.71a39.714,39.714,0,0,0,10.8-2.806A44.378,44.378,0,0,0,143.973,219.3a45.756,45.756,0,0,0,3.616-7.758,42.829,42.829,0,0,0,2.525-14.4,37.315,37.315,0,0,0-5.149-19.237,33.857,33.857,0,0,0-2.975-4.256,34.2,34.2,0,0,0-4.424-4.488c-.1-.077-.183-.162-.289-.239L96.13,173.27a12.346,12.346,0,0,0-1.343.077,14.371,14.371,0,0,0-3.672.886,16.157,16.157,0,0,0-9.664,10.677,14.95,14.95,0,0,0-.527,3.89,12.978,12.978,0,0,0,1.554,6.26l-30.316-4.094a44.212,44.212,0,0,1-6.386-9.235,38.952,38.952,0,0,1-1.639-3.538c-.021-.443-.028-.886-.028-1.329a38.115,38.115,0,0,1,5.022-18.689c5.838-9.988,16.206-17.31,27.973-18.506l27.474-2.806,14.68-1.505,31.335-3.2c18.253-1.864,33,11.626,33,30.118" transform="translate(-2.958 -89.093)" fill="#fff" opacity="0.4"/><path id="Unseen" d="M225.85,694.376a10.768,10.768,0,0,1-4.973,5.3,10.914,10.914,0,0,1-5,1.193h-21.11V690.179h15.966a4.735,4.735,0,0,0,.724-.052,5.031,5.031,0,0,0,3.7-7.373h9.218a10.684,10.684,0,0,1,2.044,4.292,11.358,11.358,0,0,1-.57,7.331" transform="translate(-131.473 -460.874)" fill="#fff" fill-opacity=".4"/><path d="M226.778,641.753v10.693H210.734a5.031,5.031,0,0,0-4.422,7.425h-9.141a10.677,10.677,0,0,1-2.044-4.293,11.362,11.362,0,0,1,.57-7.332,10.783,10.783,0,0,1,4.973-5.3,10.94,10.94,0,0,1,5-1.191Z" transform="translate(-131.473 -433.198)" fill="#fff" fill-opacity=".4"/><path d="M16.189,641.747v23.979H10.513V641.747H0v28.271a3.211,3.211,0,0,0,3.231,3.175H23.472a3.189,3.189,0,0,0,3.184-3.175V641.747Z" transform="translate(0 -433.194)" fill="#fff" fill-opacity=".4"/><path id="Path_4901" data-name="Path 4901" d="M123.966,641.75v31.444H113.452V655.732l-6.867,17.462H95.775V641.75h10.514v17.472l6.867-17.472Z" transform="translate(-64.65 -433.196)" fill="#fff" fill-opacity=".4"/><path id="Path_4902" data-name="Path 4902" d="M497.288,641.75v31.444h-10.81l-6.867-17.462v17.462H469.1V641.75H479.9l6.867,17.472V641.75Z" transform="translate(-316.652 -433.196)" fill="#fff" fill-opacity=".4"/><path id="Path_4903" data-name="Path 4903" d="M328.688,649.214v-7.467H306.656v31.447h22.032v-7.467H317.169V661.2h11.519v-7.467H317.169v-4.523Z" transform="translate(-207 -433.194)" fill="#fff" fill-opacity=".4"/><path id="Path_4904" data-name="Path 4904" d="M409.918,649.214v-7.467H387.886v31.447h22.032v-7.467H398.4V661.2h11.519v-7.467H398.4v-4.523Z" transform="translate(-261.832 -433.194)" fill="#fff" fill-opacity=".4"/></g><g id="Progress" fill="#fff"><rect width="144" height="100" fill-opacity=".03" rx="15" ry="15" stroke="#fff" stroke-opacity=".1" stroke-width="4"/><text x="20" y="34" font-family="\'Courier New\',Arial,monospace" font-size="22px">Progress</text><text x="20" y="72" font-family="\'Courier New\',Arial,monospace" font-size="26px">0%</text></g><g id="Status" fill="#fff"><rect width="152" height="100" fill-opacity=".03" rx="15" ry="15" stroke="#fff" stroke-opacity=".1" stroke-width="4"/><text x="20" y="34" font-family="\'Courier New\',Arial,monospace" font-size="22px">Status</text><text x="20" y="72" font-family="\'Courier New\',Arial,monospace" font-size="26px">Pending</text></g><g id="Amount" fill="#fff"><rect width="118" height="100" fill-opacity=".03" rx="15" ry="15" stroke="#fff" stroke-opacity=".1" stroke-width="4"/><text x="20" y="34" font-family="\'Courier New\',Arial,monospace" font-size="22px">Amount</text><text x="20" y="72" font-family="\'Courier New\',Arial,monospace" font-size="26px">100</text></g><g id="Duration" fill="#fff"><rect width="144" height="100" fill-opacity=".03" rx="15" ry="15" stroke="#fff" stroke-opacity=".1" stroke-width="4"/><text x="20" y="34" font-family="\'Courier New\',Arial,monospace" font-size="22px">Duration</text><text x="20" y="72" font-family="\'Courier New\',Arial,monospace" font-size="26px">5 Days</text></g></defs><text text-rendering="optimizeSpeed"><textPath startOffset="-100%" href="#FloatingText" fill="#fff" font-family="\'Courier New\',Arial,monospace" fill-opacity=".8" font-size="26px"><animate additive="sum" attributeName="startOffset" begin="0s" dur="50s" from="0%" repeatCount="indefinite" to="100%"/>0xf3a045dc986015be9ae43bb3462ae5981b0816e0 • Unseen Vesting</textPath><textPath startOffset="0%" href="#FloatingText" fill="#fff" font-family="\'Courier New\',Arial,monospace" fill-opacity=".8" font-size="26px"><animate additive="sum" attributeName="startOffset" begin="0s" dur="50s" from="0%" repeatCount="indefinite" to="100%"/>0xf3a045dc986015be9ae43bb3462ae5981b0816e0 • Unseen Vesting</textPath><textPath startOffset="-50%" href="#FloatingText" fill="#fff" font-family="\'Courier New\',Arial,monospace" fill-opacity=".8" font-size="26px"><animate additive="sum" attributeName="startOffset" begin="0s" dur="50s" from="0%" repeatCount="indefinite" to="100%"/>0x03a6a84cd762d9707a21605b548aaab891562aab • UNCN</textPath><textPath startOffset="50%" href="#FloatingText" fill="#fff" font-family="\'Courier New\',Arial,monospace" fill-opacity=".8" font-size="26px"><animate additive="sum" attributeName="startOffset" begin="0s" dur="50s" from="0%" repeatCount="indefinite" to="100%"/>0x03a6a84cd762d9707a21605b548aaab891562aab • UNCN</textPath></text><use href="#Logo" x="110" y="50" transform="scale(2.5)" /><use href="#Progress" x="197" y="790"/><use href="#Status" x="357" y="790"/><use href="#Amount" x="525" y="790"/><use href="#Duration" x="659" y="790"/></svg>';

      expect(actualSVG).to.eq(expectedSVG);
    });
    it('ongoing schedule svg', async function () {
      const signGE = await svgElementsMock.getSignGE();
      const amount = signGE.concat(' 1.23M');
      const actualSVG = await vestingNFTDescriptorMock.generateSVG_({
        accentColor: 'hsl(114,3%,53%)',
        amount,
        uncnAddress: '0x03a6a84cd762d9707a21605b548aaab891562aab',
        uncnSymbol: 'UNCN',
        duration: '91 Days',
        progress: '42.35%',
        progressNumerical: 4235,
        unseenVestingAddress: '0xf3a045dc986015be9ae43bb3462ae5981b0816e0',
        status: 'Ongoing',
        vestingModel: 'UNCN-VESTING',
      });

      const expectedSVG =
        '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000"><rect width="100%" height="100%" filter="url(#Noise)"/><rect x="70" y="70" width="860" height="860" fill="#fff" fill-opacity=".03" rx="45" ry="45" stroke="#fff" stroke-opacity=".1" stroke-width="4"/><defs><filter id="Noise"><feFlood x="0" y="0" width="100%" height="100%" flood-color="hsl(230,21%,11%)" flood-opacity="1" result="floodFill"/><feTurbulence baseFrequency=".4" numOctaves="3" result="Noise" type="fractalNoise"/><feBlend in="Noise" in2="floodFill" mode="soft-light"/></filter><path d="M180.637,46.426V57.751a32.284,32.284,0,0,0-6.1-8.652,32.764,32.764,0,0,0-23.549-9.678,36.5,36.5,0,0,0-3.707.19l-45.607,4.663L73.267,40.4c-13.463-1.836-25.4,3.51-32.306,13.1-.063.1-.141.2-.2.3A35.921,35.921,0,0,0,34.7,73.731a42.58,42.58,0,0,0,3.046,16.136,45.286,45.286,0,0,0,1.99,4.375,46.717,46.717,0,0,0,3.01,5.022c.281.408.563.816.865,1.21a48.117,48.117,0,0,0,3.883,4.671L74.6,108.8l14.932,2.019v-.035c.324.063.655.12.985.169a13.708,13.708,0,0,0,2.321.119h.05a13.821,13.821,0,0,0,1.435-.134,11.722,11.722,0,0,0,9.657-8.222,13.282,13.282,0,0,0,.577-3.8,13.791,13.791,0,0,0-4.938-11.936l3.531-.373,30.048-3.172a31.69,31.69,0,0,1,5.838,7.153,34.057,34.057,0,0,1,4.656,17.458c0,.711-.021,1.428-.063,2.138a40.767,40.767,0,0,1-5.592,18.238c-6.457,10.67-17.282,17.824-28.965,19.139a48.088,48.088,0,0,1-11.8-.123L33.5,138.885C14.774,136.374-.25,119.134,0,100.495l1.076-78.6C1.27,8,12.791-1.678,26.809.243L155.435,17.891c13.92,1.913,25.2,14.672,25.2,28.536" transform="translate(0 0)" fill="#fff" opacity="0.4"/><path id="Path_4897" data-name="Path 4897" d="M183.595,162.276v78.49c0,13.969-11.134,26.588-24.9,28.184L30.069,283.861C15.9,285.507,4.382,275.315,4.382,261.093v-28.5c6.823,10.994,19.518,17.479,33.98,15.854l67.742-7.625,6.316-.71a39.714,39.714,0,0,0,10.8-2.806A44.378,44.378,0,0,0,143.973,219.3a45.756,45.756,0,0,0,3.616-7.758,42.829,42.829,0,0,0,2.525-14.4,37.315,37.315,0,0,0-5.149-19.237,33.857,33.857,0,0,0-2.975-4.256,34.2,34.2,0,0,0-4.424-4.488c-.1-.077-.183-.162-.289-.239L96.13,173.27a12.346,12.346,0,0,0-1.343.077,14.371,14.371,0,0,0-3.672.886,16.157,16.157,0,0,0-9.664,10.677,14.95,14.95,0,0,0-.527,3.89,12.978,12.978,0,0,0,1.554,6.26l-30.316-4.094a44.212,44.212,0,0,1-6.386-9.235,38.952,38.952,0,0,1-1.639-3.538c-.021-.443-.028-.886-.028-1.329a38.115,38.115,0,0,1,5.022-18.689c5.838-9.988,16.206-17.31,27.973-18.506l27.474-2.806,14.68-1.505,31.335-3.2c18.253-1.864,33,11.626,33,30.118" transform="translate(-2.958 -89.093)" fill="#fff" opacity="0.4"/><path id="FloatingText" fill="none" d="M125 45h750s80 0 80 80v750s0 80 -80 80h-750s-80 0 -80 -80v-750s0 -80 80 -80"/><g id="Logo"><path d="M180.637,46.426V57.751a32.284,32.284,0,0,0-6.1-8.652,32.764,32.764,0,0,0-23.549-9.678,36.5,36.5,0,0,0-3.707.19l-45.607,4.663L73.267,40.4c-13.463-1.836-25.4,3.51-32.306,13.1-.063.1-.141.2-.2.3A35.921,35.921,0,0,0,34.7,73.731a42.58,42.58,0,0,0,3.046,16.136,45.286,45.286,0,0,0,1.99,4.375,46.717,46.717,0,0,0,3.01,5.022c.281.408.563.816.865,1.21a48.117,48.117,0,0,0,3.883,4.671L74.6,108.8l14.932,2.019v-.035c.324.063.655.12.985.169a13.708,13.708,0,0,0,2.321.119h.05a13.821,13.821,0,0,0,1.435-.134,11.722,11.722,0,0,0,9.657-8.222,13.282,13.282,0,0,0,.577-3.8,13.791,13.791,0,0,0-4.938-11.936l3.531-.373,30.048-3.172a31.69,31.69,0,0,1,5.838,7.153,34.057,34.057,0,0,1,4.656,17.458c0,.711-.021,1.428-.063,2.138a40.767,40.767,0,0,1-5.592,18.238c-6.457,10.67-17.282,17.824-28.965,19.139a48.088,48.088,0,0,1-11.8-.123L33.5,138.885C14.774,136.374-.25,119.134,0,100.495l1.076-78.6C1.27,8,12.791-1.678,26.809.243L155.435,17.891c13.92,1.913,25.2,14.672,25.2,28.536" transform="translate(0 0)" fill="#fff" opacity="0.4"/><path id="Path_4897" data-name="Path 4897" d="M183.595,162.276v78.49c0,13.969-11.134,26.588-24.9,28.184L30.069,283.861C15.9,285.507,4.382,275.315,4.382,261.093v-28.5c6.823,10.994,19.518,17.479,33.98,15.854l67.742-7.625,6.316-.71a39.714,39.714,0,0,0,10.8-2.806A44.378,44.378,0,0,0,143.973,219.3a45.756,45.756,0,0,0,3.616-7.758,42.829,42.829,0,0,0,2.525-14.4,37.315,37.315,0,0,0-5.149-19.237,33.857,33.857,0,0,0-2.975-4.256,34.2,34.2,0,0,0-4.424-4.488c-.1-.077-.183-.162-.289-.239L96.13,173.27a12.346,12.346,0,0,0-1.343.077,14.371,14.371,0,0,0-3.672.886,16.157,16.157,0,0,0-9.664,10.677,14.95,14.95,0,0,0-.527,3.89,12.978,12.978,0,0,0,1.554,6.26l-30.316-4.094a44.212,44.212,0,0,1-6.386-9.235,38.952,38.952,0,0,1-1.639-3.538c-.021-.443-.028-.886-.028-1.329a38.115,38.115,0,0,1,5.022-18.689c5.838-9.988,16.206-17.31,27.973-18.506l27.474-2.806,14.68-1.505,31.335-3.2c18.253-1.864,33,11.626,33,30.118" transform="translate(-2.958 -89.093)" fill="#fff" opacity="0.4"/><path id="Unseen" d="M225.85,694.376a10.768,10.768,0,0,1-4.973,5.3,10.914,10.914,0,0,1-5,1.193h-21.11V690.179h15.966a4.735,4.735,0,0,0,.724-.052,5.031,5.031,0,0,0,3.7-7.373h9.218a10.684,10.684,0,0,1,2.044,4.292,11.358,11.358,0,0,1-.57,7.331" transform="translate(-131.473 -460.874)" fill="#fff" fill-opacity=".4"/><path d="M226.778,641.753v10.693H210.734a5.031,5.031,0,0,0-4.422,7.425h-9.141a10.677,10.677,0,0,1-2.044-4.293,11.362,11.362,0,0,1,.57-7.332,10.783,10.783,0,0,1,4.973-5.3,10.94,10.94,0,0,1,5-1.191Z" transform="translate(-131.473 -433.198)" fill="#fff" fill-opacity=".4"/><path d="M16.189,641.747v23.979H10.513V641.747H0v28.271a3.211,3.211,0,0,0,3.231,3.175H23.472a3.189,3.189,0,0,0,3.184-3.175V641.747Z" transform="translate(0 -433.194)" fill="#fff" fill-opacity=".4"/><path id="Path_4901" data-name="Path 4901" d="M123.966,641.75v31.444H113.452V655.732l-6.867,17.462H95.775V641.75h10.514v17.472l6.867-17.472Z" transform="translate(-64.65 -433.196)" fill="#fff" fill-opacity=".4"/><path id="Path_4902" data-name="Path 4902" d="M497.288,641.75v31.444h-10.81l-6.867-17.462v17.462H469.1V641.75H479.9l6.867,17.472V641.75Z" transform="translate(-316.652 -433.196)" fill="#fff" fill-opacity=".4"/><path id="Path_4903" data-name="Path 4903" d="M328.688,649.214v-7.467H306.656v31.447h22.032v-7.467H317.169V661.2h11.519v-7.467H317.169v-4.523Z" transform="translate(-207 -433.194)" fill="#fff" fill-opacity=".4"/><path id="Path_4904" data-name="Path 4904" d="M409.918,649.214v-7.467H387.886v31.447h22.032v-7.467H398.4V661.2h11.519v-7.467H398.4v-4.523Z" transform="translate(-261.832 -433.194)" fill="#fff" fill-opacity=".4"/></g><g id="Progress" fill="#fff"><rect width="208" height="100" fill-opacity=".03" rx="15" ry="15" stroke="#fff" stroke-opacity=".1" stroke-width="4"/><text x="20" y="34" font-family="\'Courier New\',Arial,monospace" font-size="22px">Progress</text><text x="20" y="72" font-family="\'Courier New\',Arial,monospace" font-size="26px">42.35%</text><g fill="none"><circle cx="166" cy="50" r="22" stroke="hsl(230,21%,11%)" stroke-width="10"/><circle cx="166" cy="50" pathLength="10000" r="22" stroke="hsl(114,3%,53%)" stroke-dasharray="10000" stroke-dashoffset="5765" stroke-linecap="round" stroke-width="5" transform="rotate(-90)" transform-origin="166 50" stroke-opacity="0.4"/></g></g><g id="Status" fill="#fff"><rect width="152" height="100" fill-opacity=".03" rx="15" ry="15" stroke="#fff" stroke-opacity=".1" stroke-width="4"/><text x="20" y="34" font-family="\'Courier New\',Arial,monospace" font-size="22px">Status</text><text x="20" y="72" font-family="\'Courier New\',Arial,monospace" font-size="26px">Ongoing</text></g><g id="Amount" fill="#fff"><rect width="152" height="100" fill-opacity=".03" rx="15" ry="15" stroke="#fff" stroke-opacity=".1" stroke-width="4"/><text x="20" y="34" font-family="\'Courier New\',Arial,monospace" font-size="22px">Amount</text><text x="20" y="72" font-family="\'Courier New\',Arial,monospace" font-size="26px">&#8805; 1.23M</text></g><g id="Duration" fill="#fff"><rect width="152" height="100" fill-opacity=".03" rx="15" ry="15" stroke="#fff" stroke-opacity=".1" stroke-width="4"/><text x="20" y="34" font-family="\'Courier New\',Arial,monospace" font-size="22px">Duration</text><text x="20" y="72" font-family="\'Courier New\',Arial,monospace" font-size="26px">91 Days</text></g></defs><text text-rendering="optimizeSpeed"><textPath startOffset="-100%" href="#FloatingText" fill="#fff" font-family="\'Courier New\',Arial,monospace" fill-opacity=".8" font-size="26px"><animate additive="sum" attributeName="startOffset" begin="0s" dur="50s" from="0%" repeatCount="indefinite" to="100%"/>0xf3a045dc986015be9ae43bb3462ae5981b0816e0 • Unseen Vesting</textPath><textPath startOffset="0%" href="#FloatingText" fill="#fff" font-family="\'Courier New\',Arial,monospace" fill-opacity=".8" font-size="26px"><animate additive="sum" attributeName="startOffset" begin="0s" dur="50s" from="0%" repeatCount="indefinite" to="100%"/>0xf3a045dc986015be9ae43bb3462ae5981b0816e0 • Unseen Vesting</textPath><textPath startOffset="-50%" href="#FloatingText" fill="#fff" font-family="\'Courier New\',Arial,monospace" fill-opacity=".8" font-size="26px"><animate additive="sum" attributeName="startOffset" begin="0s" dur="50s" from="0%" repeatCount="indefinite" to="100%"/>0x03a6a84cd762d9707a21605b548aaab891562aab • UNCN</textPath><textPath startOffset="50%" href="#FloatingText" fill="#fff" font-family="\'Courier New\',Arial,monospace" fill-opacity=".8" font-size="26px"><animate additive="sum" attributeName="startOffset" begin="0s" dur="50s" from="0%" repeatCount="indefinite" to="100%"/>0x03a6a84cd762d9707a21605b548aaab891562aab • UNCN</textPath></text><use href="#Logo" x="110" y="50" transform="scale(2.5)" /><use href="#Progress" x="144" y="790"/><use href="#Status" x="368" y="790"/><use href="#Amount" x="536" y="790"/><use href="#Duration" x="704" y="790"/></svg>';

      expect(actualSVG).to.eq(expectedSVG);
    });
    it('depleted schedule svg', async function () {
      const actualSVG = await vestingNFTDescriptorMock.generateSVG_({
        accentColor: 'hsl(123,25%,44%)',
        amount: '100',
        uncnAddress: '0x03a6a84cd762d9707a21605b548aaab891562aab',
        uncnSymbol: 'UNCN',
        duration: '5 Days',
        progress: '100%',
        progressNumerical: 100,
        unseenVestingAddress: '0xf3a045dc986015be9ae43bb3462ae5981b0816e0',
        status: 'Depleted',
        vestingModel: 'UNCN-VESTING',
      });

      const expectedSVG =
        '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000"><rect width="100%" height="100%" filter="url(#Noise)"/><rect x="70" y="70" width="860" height="860" fill="#fff" fill-opacity=".03" rx="45" ry="45" stroke="#fff" stroke-opacity=".1" stroke-width="4"/><defs><filter id="Noise"><feFlood x="0" y="0" width="100%" height="100%" flood-color="hsl(230,21%,11%)" flood-opacity="1" result="floodFill"/><feTurbulence baseFrequency=".4" numOctaves="3" result="Noise" type="fractalNoise"/><feBlend in="Noise" in2="floodFill" mode="soft-light"/></filter><path d="M180.637,46.426V57.751a32.284,32.284,0,0,0-6.1-8.652,32.764,32.764,0,0,0-23.549-9.678,36.5,36.5,0,0,0-3.707.19l-45.607,4.663L73.267,40.4c-13.463-1.836-25.4,3.51-32.306,13.1-.063.1-.141.2-.2.3A35.921,35.921,0,0,0,34.7,73.731a42.58,42.58,0,0,0,3.046,16.136,45.286,45.286,0,0,0,1.99,4.375,46.717,46.717,0,0,0,3.01,5.022c.281.408.563.816.865,1.21a48.117,48.117,0,0,0,3.883,4.671L74.6,108.8l14.932,2.019v-.035c.324.063.655.12.985.169a13.708,13.708,0,0,0,2.321.119h.05a13.821,13.821,0,0,0,1.435-.134,11.722,11.722,0,0,0,9.657-8.222,13.282,13.282,0,0,0,.577-3.8,13.791,13.791,0,0,0-4.938-11.936l3.531-.373,30.048-3.172a31.69,31.69,0,0,1,5.838,7.153,34.057,34.057,0,0,1,4.656,17.458c0,.711-.021,1.428-.063,2.138a40.767,40.767,0,0,1-5.592,18.238c-6.457,10.67-17.282,17.824-28.965,19.139a48.088,48.088,0,0,1-11.8-.123L33.5,138.885C14.774,136.374-.25,119.134,0,100.495l1.076-78.6C1.27,8,12.791-1.678,26.809.243L155.435,17.891c13.92,1.913,25.2,14.672,25.2,28.536" transform="translate(0 0)" fill="#fff" opacity="0.4"/><path id="Path_4897" data-name="Path 4897" d="M183.595,162.276v78.49c0,13.969-11.134,26.588-24.9,28.184L30.069,283.861C15.9,285.507,4.382,275.315,4.382,261.093v-28.5c6.823,10.994,19.518,17.479,33.98,15.854l67.742-7.625,6.316-.71a39.714,39.714,0,0,0,10.8-2.806A44.378,44.378,0,0,0,143.973,219.3a45.756,45.756,0,0,0,3.616-7.758,42.829,42.829,0,0,0,2.525-14.4,37.315,37.315,0,0,0-5.149-19.237,33.857,33.857,0,0,0-2.975-4.256,34.2,34.2,0,0,0-4.424-4.488c-.1-.077-.183-.162-.289-.239L96.13,173.27a12.346,12.346,0,0,0-1.343.077,14.371,14.371,0,0,0-3.672.886,16.157,16.157,0,0,0-9.664,10.677,14.95,14.95,0,0,0-.527,3.89,12.978,12.978,0,0,0,1.554,6.26l-30.316-4.094a44.212,44.212,0,0,1-6.386-9.235,38.952,38.952,0,0,1-1.639-3.538c-.021-.443-.028-.886-.028-1.329a38.115,38.115,0,0,1,5.022-18.689c5.838-9.988,16.206-17.31,27.973-18.506l27.474-2.806,14.68-1.505,31.335-3.2c18.253-1.864,33,11.626,33,30.118" transform="translate(-2.958 -89.093)" fill="#fff" opacity="0.4"/><path id="FloatingText" fill="none" d="M125 45h750s80 0 80 80v750s0 80 -80 80h-750s-80 0 -80 -80v-750s0 -80 80 -80"/><g id="Logo"><path d="M180.637,46.426V57.751a32.284,32.284,0,0,0-6.1-8.652,32.764,32.764,0,0,0-23.549-9.678,36.5,36.5,0,0,0-3.707.19l-45.607,4.663L73.267,40.4c-13.463-1.836-25.4,3.51-32.306,13.1-.063.1-.141.2-.2.3A35.921,35.921,0,0,0,34.7,73.731a42.58,42.58,0,0,0,3.046,16.136,45.286,45.286,0,0,0,1.99,4.375,46.717,46.717,0,0,0,3.01,5.022c.281.408.563.816.865,1.21a48.117,48.117,0,0,0,3.883,4.671L74.6,108.8l14.932,2.019v-.035c.324.063.655.12.985.169a13.708,13.708,0,0,0,2.321.119h.05a13.821,13.821,0,0,0,1.435-.134,11.722,11.722,0,0,0,9.657-8.222,13.282,13.282,0,0,0,.577-3.8,13.791,13.791,0,0,0-4.938-11.936l3.531-.373,30.048-3.172a31.69,31.69,0,0,1,5.838,7.153,34.057,34.057,0,0,1,4.656,17.458c0,.711-.021,1.428-.063,2.138a40.767,40.767,0,0,1-5.592,18.238c-6.457,10.67-17.282,17.824-28.965,19.139a48.088,48.088,0,0,1-11.8-.123L33.5,138.885C14.774,136.374-.25,119.134,0,100.495l1.076-78.6C1.27,8,12.791-1.678,26.809.243L155.435,17.891c13.92,1.913,25.2,14.672,25.2,28.536" transform="translate(0 0)" fill="#fff" opacity="0.4"/><path id="Path_4897" data-name="Path 4897" d="M183.595,162.276v78.49c0,13.969-11.134,26.588-24.9,28.184L30.069,283.861C15.9,285.507,4.382,275.315,4.382,261.093v-28.5c6.823,10.994,19.518,17.479,33.98,15.854l67.742-7.625,6.316-.71a39.714,39.714,0,0,0,10.8-2.806A44.378,44.378,0,0,0,143.973,219.3a45.756,45.756,0,0,0,3.616-7.758,42.829,42.829,0,0,0,2.525-14.4,37.315,37.315,0,0,0-5.149-19.237,33.857,33.857,0,0,0-2.975-4.256,34.2,34.2,0,0,0-4.424-4.488c-.1-.077-.183-.162-.289-.239L96.13,173.27a12.346,12.346,0,0,0-1.343.077,14.371,14.371,0,0,0-3.672.886,16.157,16.157,0,0,0-9.664,10.677,14.95,14.95,0,0,0-.527,3.89,12.978,12.978,0,0,0,1.554,6.26l-30.316-4.094a44.212,44.212,0,0,1-6.386-9.235,38.952,38.952,0,0,1-1.639-3.538c-.021-.443-.028-.886-.028-1.329a38.115,38.115,0,0,1,5.022-18.689c5.838-9.988,16.206-17.31,27.973-18.506l27.474-2.806,14.68-1.505,31.335-3.2c18.253-1.864,33,11.626,33,30.118" transform="translate(-2.958 -89.093)" fill="#fff" opacity="0.4"/><path id="Unseen" d="M225.85,694.376a10.768,10.768,0,0,1-4.973,5.3,10.914,10.914,0,0,1-5,1.193h-21.11V690.179h15.966a4.735,4.735,0,0,0,.724-.052,5.031,5.031,0,0,0,3.7-7.373h9.218a10.684,10.684,0,0,1,2.044,4.292,11.358,11.358,0,0,1-.57,7.331" transform="translate(-131.473 -460.874)" fill="#fff" fill-opacity=".4"/><path d="M226.778,641.753v10.693H210.734a5.031,5.031,0,0,0-4.422,7.425h-9.141a10.677,10.677,0,0,1-2.044-4.293,11.362,11.362,0,0,1,.57-7.332,10.783,10.783,0,0,1,4.973-5.3,10.94,10.94,0,0,1,5-1.191Z" transform="translate(-131.473 -433.198)" fill="#fff" fill-opacity=".4"/><path d="M16.189,641.747v23.979H10.513V641.747H0v28.271a3.211,3.211,0,0,0,3.231,3.175H23.472a3.189,3.189,0,0,0,3.184-3.175V641.747Z" transform="translate(0 -433.194)" fill="#fff" fill-opacity=".4"/><path id="Path_4901" data-name="Path 4901" d="M123.966,641.75v31.444H113.452V655.732l-6.867,17.462H95.775V641.75h10.514v17.472l6.867-17.472Z" transform="translate(-64.65 -433.196)" fill="#fff" fill-opacity=".4"/><path id="Path_4902" data-name="Path 4902" d="M497.288,641.75v31.444h-10.81l-6.867-17.462v17.462H469.1V641.75H479.9l6.867,17.472V641.75Z" transform="translate(-316.652 -433.196)" fill="#fff" fill-opacity=".4"/><path id="Path_4903" data-name="Path 4903" d="M328.688,649.214v-7.467H306.656v31.447h22.032v-7.467H317.169V661.2h11.519v-7.467H317.169v-4.523Z" transform="translate(-207 -433.194)" fill="#fff" fill-opacity=".4"/><path id="Path_4904" data-name="Path 4904" d="M409.918,649.214v-7.467H387.886v31.447h22.032v-7.467H398.4V661.2h11.519v-7.467H398.4v-4.523Z" transform="translate(-261.832 -433.194)" fill="#fff" fill-opacity=".4"/></g><g id="Progress" fill="#fff"><rect width="208" height="100" fill-opacity=".03" rx="15" ry="15" stroke="#fff" stroke-opacity=".1" stroke-width="4"/><text x="20" y="34" font-family="\'Courier New\',Arial,monospace" font-size="22px">Progress</text><text x="20" y="72" font-family="\'Courier New\',Arial,monospace" font-size="26px">100%</text><g fill="none"><circle cx="166" cy="50" r="22" stroke="hsl(230,21%,11%)" stroke-width="10"/><circle cx="166" cy="50" pathLength="10000" r="22" stroke="hsl(123,25%,44%)" stroke-dasharray="10000" stroke-dashoffset="9900" stroke-linecap="round" stroke-width="5" transform="rotate(-90)" transform-origin="166 50" stroke-opacity="0.4"/></g></g><g id="Status" fill="#fff"><rect width="168" height="100" fill-opacity=".03" rx="15" ry="15" stroke="#fff" stroke-opacity=".1" stroke-width="4"/><text x="20" y="34" font-family="\'Courier New\',Arial,monospace" font-size="22px">Status</text><text x="20" y="72" font-family="\'Courier New\',Arial,monospace" font-size="26px">Depleted</text></g><g id="Amount" fill="#fff"><rect width="118" height="100" fill-opacity=".03" rx="15" ry="15" stroke="#fff" stroke-opacity=".1" stroke-width="4"/><text x="20" y="34" font-family="\'Courier New\',Arial,monospace" font-size="22px">Amount</text><text x="20" y="72" font-family="\'Courier New\',Arial,monospace" font-size="26px">100</text></g><g id="Duration" fill="#fff"><rect width="144" height="100" fill-opacity=".03" rx="15" ry="15" stroke="#fff" stroke-opacity=".1" stroke-width="4"/><text x="20" y="34" font-family="\'Courier New\',Arial,monospace" font-size="22px">Duration</text><text x="20" y="72" font-family="\'Courier New\',Arial,monospace" font-size="26px">5 Days</text></g></defs><text text-rendering="optimizeSpeed"><textPath startOffset="-100%" href="#FloatingText" fill="#fff" font-family="\'Courier New\',Arial,monospace" fill-opacity=".8" font-size="26px"><animate additive="sum" attributeName="startOffset" begin="0s" dur="50s" from="0%" repeatCount="indefinite" to="100%"/>0xf3a045dc986015be9ae43bb3462ae5981b0816e0 • Unseen Vesting</textPath><textPath startOffset="0%" href="#FloatingText" fill="#fff" font-family="\'Courier New\',Arial,monospace" fill-opacity=".8" font-size="26px"><animate additive="sum" attributeName="startOffset" begin="0s" dur="50s" from="0%" repeatCount="indefinite" to="100%"/>0xf3a045dc986015be9ae43bb3462ae5981b0816e0 • Unseen Vesting</textPath><textPath startOffset="-50%" href="#FloatingText" fill="#fff" font-family="\'Courier New\',Arial,monospace" fill-opacity=".8" font-size="26px"><animate additive="sum" attributeName="startOffset" begin="0s" dur="50s" from="0%" repeatCount="indefinite" to="100%"/>0x03a6a84cd762d9707a21605b548aaab891562aab • UNCN</textPath><textPath startOffset="50%" href="#FloatingText" fill="#fff" font-family="\'Courier New\',Arial,monospace" fill-opacity=".8" font-size="26px"><animate additive="sum" attributeName="startOffset" begin="0s" dur="50s" from="0%" repeatCount="indefinite" to="100%"/>0x03a6a84cd762d9707a21605b548aaab891562aab • UNCN</textPath></text><use href="#Logo" x="110" y="50" transform="scale(2.5)" /><use href="#Progress" x="157" y="790"/><use href="#Status" x="381" y="790"/><use href="#Amount" x="565" y="790"/><use href="#Duration" x="699" y="790"/></svg>';

      expect(actualSVG).to.eq(expectedSVG);
    });
  });
  context('card type stringified', function () {
    it('should stringify properly card types', async function () {
      expect(await svgElementsMock.stringifyCardType(0), 'Progress');
      expect(await svgElementsMock.stringifyCardType(1), 'Status');
      expect(await svgElementsMock.stringifyCardType(2), 'Amount');
      expect(await svgElementsMock.stringifyCardType(3), 'Duration');
    });
  });
  context('percentage stringified', function () {
    it('with no fractional part', async function () {
      expect(await sp(0)).to.eq('0%');
      expect(await sp(100)).to.eq('1%');
      expect(await sp(300)).to.eq('3%');
      expect(await sp(1000)).to.eq('10%');
      expect(await sp(4200)).to.eq('42%');
      expect(await sp(10_000)).to.eq('100%');
    });
    it('with fractional part', async function () {
      expect(await sp(1)).to.eq('0.01%');
      expect(await sp(42)).to.eq('0.42%');
      expect(await sp(314)).to.eq('3.14%');
      expect(await sp(2064)).to.eq('20.64%');
      expect(await sp(6588)).to.eq('65.88%');
      expect(await sp(9999)).to.eq('99.99%');
    });
  });
  context('status stringified', function () {
    it('should stringify properly schedule status', async function () {
      expect(await vestingNFTDescriptorMock.stringifyStatus_(4)).to.eq(
        'Depleted',
        'depleted status mismatch'
      );
      expect(await vestingNFTDescriptorMock.stringifyStatus_(3)).to.eq(
        'Canceled',
        'canceled status mismatch'
      );
      expect(await vestingNFTDescriptorMock.stringifyStatus_(1)).to.eq(
        'Ongoing',
        'vesting status mismatch'
      );
      expect(await vestingNFTDescriptorMock.stringifyStatus_(2)).to.eq(
        'Settled',
        'settled status mismatch'
      );
      expect(await vestingNFTDescriptorMock.stringifyStatus_(0)).to.eq(
        'Pending',
        'pending status mismatch'
      );
    });
  });
  context('fractional amount stringified', function () {
    it('zero', async function () {
      expect(await sfa(0)).to.eq('', 'fractional part mismatch');
    });
    it('leading zero', async function () {
      expect(await sfa(1)).to.eq('.01', 'fractional part mismatch');
      expect(await sfa(5)).to.eq('.05', 'fractional part mismatch');
      expect(await sfa(9)).to.eq('.09', 'fractional part mismatch');
    });
    it('no leading zero', async function () {
      expect(await sfa(10)).to.eq('.10', 'fractional part mismatch');
      expect(await sfa(12)).to.eq('.12', 'fractional part mismatch');
      expect(await sfa(33)).to.eq('.33', 'fractional part mismatch');
      expect(await sfa(42)).to.eq('.42', 'fractional part mismatch');
      expect(await sfa(70)).to.eq('.70', 'fractional part mismatch');
      expect(await sfa(99)).to.eq('.99', 'fractional part mismatch');
    });
  });
});
