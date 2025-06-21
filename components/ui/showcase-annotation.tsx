import { HydrationBoundary } from 'jotai-ssr'
import Markdown from '../markdown'
import { langAtom } from '@/app/library/[lib]/atoms'
import ScopeProvider from '../jotai/scope-provider'

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
