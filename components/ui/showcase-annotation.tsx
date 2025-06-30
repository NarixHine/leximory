import { HydrationBoundary } from 'jotai-ssr'
import Markdown from '../markdown'
import { langAtom } from '@/app/library/[lib]/atoms'
import ScopeProvider from '../jotai/scope-provider'
import { lexiconAtom } from '@/app/library/[lib]/[text]/atoms'

export default function ShowcaseAnnotation() {
    return <ScopeProvider atoms={[langAtom]}>
        <HydrationBoundary hydrateAtoms={[
            [langAtom, 'en']
        ]}>
            <Markdown
                disableSave
                md={':::cad56b4\nYes, the newspapers were right: snow was {{general||general||**adj. 普遍的** `ˈdʒɛnərəl` affecting or concerning all or most people||意为“整体的、普遍的”: ***gen*** (birth) + ***-al*** (forming adj.)||***gen*** (birth) → **gen**erate (产生), **gen**etics (遗传学)}} all over Ireland. It was falling on every part of the dark {{central||central||**adj. 中心的** `ˈsɛntrəl` of, at, or near the center||意为“中心的”: ***centr*** (center) + ***-al*** (forming adj.)||***centr*** (center) → con**cen**tric (同心的), ec**cent**ric (古怪的)}} plain, on the treeless hills, falling softly upon the {{Bog of Allen||Bog of Allen||**n. 阿伦沼泽** a large area of wet, spongy ground in Ireland}} and, farther {{westward||westward||**adv. 向西** `ˈwɛstwəd` in the direction of the west||意为“向西的”: ***west*** (west) + ***-ward*** (forming adv.)||***west*** (西) → **west**ern (西方的); ***-ward*** (方向) → to**ward** (朝向)}}, softly falling into the dark {{mutinous||mutinous||**adj. 叛乱的** `ˈmjuːtɪnəs` refusing to obey the orders of a person in authority||意为“叛乱的、反抗的”: ***mutin*** (revolt) + ***-ous*** (forming adj.)||***mutin*** (revolt) → **mu**tineer (叛乱者)}} Shannon waves. It was falling, too, upon every part of the lonely {{churchyard||churchyard||**n. 教堂墓地** `ˈtʃɜːtʃjɑːd` an area of land around a church, often containing graves||意为“教堂周围的土地”: ***church*** (教堂) + ***yard*** (院子)||***church*** (教堂) → **church**goer (教堂常客); ***yard*** (院子) → back**yard** (后院)}} on the hill where Michael Furey lay buried. It lay thickly drifted on the crooked {{crosses||cross||**n. 十字架** `krɒs` a structure consisting of an upright and a transverse piece||意为“十字形”||***cross*** (交叉) → **cross**road (十字路口)}} and headstones, on the spears of the little gate, on the barren {{thorns||thorn||**n. 荆棘** `θɔːn` a sharp, pointed growth on a plant||“带刺的植物”||***thorn*** (thorn) → **thorn**y (多刺的)}}. His soul swooned slowly as he heard the snow falling faintly through the universe and faintly falling, like the {{descent||descent||**n. 下降** `dɪˈsɛnt` the action of moving downward||意为“下落”: ***de-*** (down) + ***scent*** (to go) ||***de-*** (down) → **de**cline (下降), **de**scend (下降); ***scent*** (去) → as**cent** (上升)}} of their last end, upon all the living and the dead.\n:::'}
            />
        </HydrationBoundary>
    </ScopeProvider>
}

export function NewYorkProseAnnotation() {
    return <ScopeProvider atoms={[langAtom, lexiconAtom]}>
        <HydrationBoundary hydrateAtoms={[
            [langAtom, 'en'],
            [lexiconAtom, 'none']
        ]}>
            <Markdown
                disableSave
                md={'Because New York City is the only place where the {{myth||myth||**n. 神话** `mɪθ` a widely held but false belief or idea||语源“言语、故事”: ***myth*** (speech, story) + ***-os*** (forming n.)||***myth*** (speech, story) → **myth**ology (神话学)}} of greatness still feels within reach—where the {{chaos||chaos||**n. 混沌** `ˈkeɪɒs` complete disorder and confusion||语源“空虚、深渊”: ***cha-*** (gap, abyss) + ***-os*** (forming n.)||***cha-*** (gap, abyss) → **cha**sm (裂缝)}} {{sharpens||sharpen||**v. 磨砺** `ˈʃɑːpən` make or become sharp or sharper||语源“使锋利”: ***sharp*** (sharp) + ***-en*** (forming v.)}} your ambition, and every street corner {{confronts||confront||**v. 使面对** `kənˈfrʌnt` *(confront someone with something)* meet (someone) face to face with hostile or argumentative intent||语源“面对面”: ***con-*** (together) + ***front*** (forehead, front) ||***con-*** (together) → **con**verge (汇聚); ***front*** (forehead, front) → af**front** (冒犯)}} you with a mirror: who are you becoming?\n\nYou love NYC because it gives shape to your hunger. It\'s a place where {{anonymity||anonymity||**n. 匿名** `ˌænəˈnɪmɪti` the condition of being anonymous||语源“无名”: ***an-*** (without) + ***onym*** (name) + ***-ity*** (forming n.)||***an-*** (without) → **an**archy (无政府状态); ***onym*** (name) → syn**onym** (同义词)}} and {{intimacy||intimacy||**n. 亲密** `ˈɪntɪməsi` close familiarity or friendship||语源“最深处”: ***intim*** (inmost) + ***-acy*** (forming n.)||***intim*** (inmost) → **intim**ate (亲密的)}} {{coexist||coexist||**v. 共存** `ˌkəʊɪɡˈzɪst` exist together or at the same time||语源“共同存在”: ***co-*** (together) + ***exist*** (exist)||***co-*** (together) → **co**operate (合作); ***exist*** (exist) → **exist**ence (存在)}}; where you can be completely alone and still feel {{tethered||tether||**v. 束缚** `ˈtɛðə(r)` tie (an animal) with a rope or chain so as to restrict its movement||语源“绳索”: ***tether*** (rope)}} to the {{pulse||pulse||**n. 脉搏** `pʌls` the rhythmic throbbing of the arteries as blood is propelled through them by the heart||语源“跳动”: ***puls*** (push, beat) + ***-us*** (forming n.)||***puls*** (push, beat) → com**puls**ion (强迫)}} of a billion dreams. It matches your {{velocity||velocity||**n. 速度** `vəˈlɒsɪti` the speed of something in a given direction||语源“快速”: ***veloc*** (swift) + ***-ity*** (forming n.)||***veloc*** (swift) → **veloc**ipede (自行车)}}. The people here choose to suffer beautifully: to pay {{exorbitant||exorbitant||**adj. 过高的** `ɪɡˈzɔːbɪtənt` (of a price or amount charged) unreasonably high||语源“超出轨道”: ***ex-*** (out of) + ***orbit*** (track, path) + ***-ant*** (forming adj.)||***ex-*** (out of) → **ex**it (出口); ***orbit*** (track, path) → **orbit**al (轨道的)}} rent for a fifth-floor {{walkup||walkup||**n. 步梯公寓** `ˈwɔːkʌp` an apartment building or apartment above the ground floor that has no elevator}} just to be near that energy, that {{proximity||proximity||**n. 接近** `prɒkˈsɪmɪti` nearness in space, time, or relationship||语源“最近”: ***proxim*** (nearest) + ***-ity*** (forming n.)||***proxim*** (nearest) → ap**proxim**ate (近似的)}} to ambition, art, money, and madness.'}
            />
        </HydrationBoundary>
    </ScopeProvider>
}
