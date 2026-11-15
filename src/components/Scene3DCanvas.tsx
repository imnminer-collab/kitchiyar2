import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DoorClosed, DoorOpen, Eye, Layers } from 'lucide-react';
import {
  APPLIANCE_CONFIGS,
  BACKSPLASH_FINISHES,
  BACKSPLASH_FINISH_ORDER,
  BOX_PRESETS,
  CABINET_FINISHES,
  CABINET_FINISH_ORDER,
  COUNTERTOP_FINISHES,
  COUNTERTOP_FINISH_ORDER,
  DOOR_STYLE_META,
  DOOR_STYLE_ORDER,
  DRAWER_PATTERNS,
  FRAME_WIDTH_OPTIONS,
  FRIDGE_FRAME_CM,
  FRIDGE_MODELS,
  FRIDGE_MODEL_ORDER,
  GAS_WIDTH_OPTIONS,
  LIFT_PATTERNS,
  OPENING_DEFAULTS,
  SINK_MODELS,
  SINK_MODEL_ORDER,
} from '../cad/constants';
import { getCornerBlockedZonesForWall } from '../cad/cornerLogic';
import {
  applyDoorBrushPreview,
  autoUnitizeBoxForHandles,
  clampBoxInternalsAfterResize,
  computeDoorBrushPreview,
  createEmptyBox,
  deleteApplianceHierarchically,
  deleteBoxHierarchically,
  eraseDoorWithRule,
  getBoxSideExposure,
  getUnitsInBox,
  placeFrameOnBox,
  removeUnitDividerWithSync,
  uid,
} from '../cad/doorRules';
import {
  BuiltKitchenScene,
  buildKitchen3DScene,
  CM,
  detectSoftwareWebGL,
  disposeObject3D,
  Scene3DHitData,
} from '../cad/scene3dBuilder';
import {
  ApplianceKind,
  BacksplashFinishId,
  BoxKind,
  CabinetFinishId,
  CountertopFinishId,
  DoorStyle,
  FridgeModel,
  HandleItem,
  HandleStyle,
  MultiSelection,
  OpeningKind,
  Orientation,
  ProjectState,
  SelectionMode,
  SinkModel,
  ToolId,
  Wall,
} from '../cad/types';
import { CursorToolPreview } from './CursorToolPreview';

const APPLIANCE_ORDER: ApplianceKind[] = ['dishwasher', 'washing'];
const OPENING_ORDER: OpeningKind[] = ['window', 'door', 'column'];

interface Scene3DCanvasProps {
  project: ProjectState;
  tool: ToolId;
  selectionMode: SelectionMode;
  drawBoxKind: BoxKind;
  doorOrient: Orientation;
  doorTargetWidth: number;
  doorVertCount: number;
  drawerPatIdx: number;
  liftPatIdx: number;
  doorStyleBrush: DoorStyle;
  cabinetFinishBrush: CabinetFinishId;
  backsplashBrush: BacksplashFinishId;
  countertopBrush: CountertopFinishId;
  shelfCount: number;
  frameWidthCm: number;
  handleStyle: HandleStyle;
  handleOrient: Orientation;
  fridgeModel: FridgeModel;
  sinkModel: SinkModel;
  gasWidth: number;
  applianceKind: ApplianceKind;
  hoodKind: 'hidden' | 'chimney';
  openingKind: OpeningKind;
  onSetDoorVertCount: (c: number) => void;
  onSetDrawerPatIdx: (i: number) => void;
  onSetLiftPatIdx: (i: number) => void;
  onSetDoorStyleBrush: (s: DoorStyle) => void;
  onSetCabinetFinishBrush: (f: CabinetFinishId) => void;
  onSetBacksplashBrush: (f: BacksplashFinishId) => void;
  onSetCountertopBrush: (f: CountertopFinishId) => void;
  onSetShelfCount: (c: number) => void;
  onSetFrameWidthCm: (w: number) => void;
  onSetFridgeModel: (m: FridgeModel) => void;
  onSetSinkModel: (m: SinkModel) => void;
  onSetGasWidth: (w: number) => void;
  onSetApplianceKind: (k: ApplianceKind) => void;
  onSetOpeningKind: (k: OpeningKind) => void;
  onSetDoorOrient?: (o: Orientation) => void;
  onSetHandleOrient?: (o: Orientation) => void;
  onSelectWallAndBox: (
    wallId: string,
    boxId: string | null,
    doorId?: string | null,
    preserveMulti?: boolean
  ) => void;
  onSetMultiSelection: (m?: MultiSelection) => void;
  onSelectUnit: (wallId: string, unit: { boxId: string; startCm: number; endCm: number } | null) => void;
  onSelectAppliance: (wallId: string, appId: string | null) => void;
  onSelectOpening: (wallId: string, openingId: string | null) => void;
  onSelectShelf: (wallId: string, boxId: string, shelfId: string | null) => void;
  onSelectHandle: (wallId: string, boxId: string, handleId: string | null) => void;
  onSelectFrame: (wallId: string, boxId: string, frameId: string | null) => void;
  onSelectUnitDivider: (wallId: string, div: { boxId: string; seamCm: number } | null) => void;
  onMoveBox: (wallId: string, boxId: string, offsetX: number, commit: boolean, sessionId?: string) => void;
  onMoveAppliance: (wallId: string, appId: string, offsetX: number, commit: boolean, sessionId?: string) => void;
  onResizeWallBoxesSynced: (
    sourceWallId: string,
    sourceBoxId: string,
    nextElevY: number,
    nextHeight: number,
    commit: boolean
  ) => void;
  onMutateWallById: (
    wallId: string,
    mutator: (wall: Wall) => void,
    commitHistory?: boolean,
    toastMsg?: string
  ) => void;
  onApplyDoorStyle: (boxId: string | null, doorIds: string[] | null, style: DoorStyle) => void;
  onApplyFinish: (
    target: 'box' | 'all-cabinets' | 'backsplash' | 'countertop',
    wallId?: string,
    boxId?: string,
    overrideId?: string
  ) => void;
  onPlaceAppliance: (wallId: string, boxId: string, desiredOffsetX: number, kindOverride?: ApplianceKind) => void;
  onPlaceFridge: (wallId: string, desiredOffsetX: number) => void;
  onPlaceOpening: (wallId: string, desiredOffsetX: number, desiredElevY?: number) => void;
  onDeleteOpening: (wallId: string, openingId: string) => void;
  onExitToSelect: () => void;
  onToast: (msg: string) => void;
}

type Drag3D =
  | {
      kind: 'move-box';
      wallId: string;
      boxId: string;
      origX: number;
      lastTargetX: number;
      startDot: number;
      sessionId: string;
    }
  | {
      kind: 'move-app';
      wallId: string;
      appId: string;
      origX: number;
      lastTargetX: number;
      startDot: number;
      sessionId: string;
    }
  | {
      kind: 'resize-box';
      wallId: string;
      boxId: string;
      side: 'left' | 'right' | 'top' | 'bottom';
      origX: number;
      origW: number;
      origElev: number;
      origH: number;
      lastElev: number;
      lastH: number;
      startDot: number;
      startY: number;
    };

function resolveHitData(obj: THREE.Object3D | null): Scene3DHitData | null {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.userData && (cur.userData as Scene3DHitData).kind) {
      return cur.userData as Scene3DHitData;
    }
    cur = cur.parent;
  }
  return null;
}

function applySelectionMode3D(
  prev: MultiSelection | undefined,
  mode: SelectionMode,
  kind: 'door' | 'box',
  itemId: string
): MultiSelection | undefined {
  const next: MultiSelection = prev
    ? {
        boxIds: [...prev.boxIds],
        doorIds: [...prev.doorIds],
        openingIds: [...prev.openingIds],
        applianceIds: [...prev.applianceIds],
      }
    : { boxIds: [], doorIds: [], openingIds: [], applianceIds: [] };
  const arr = kind === 'door' ? next.doorIds : next.boxIds;
  if (mode === 'add') {
    if (!arr.includes(itemId)) arr.push(itemId);
  } else if (mode === 'subtract') {
    const idx = arr.indexOf(itemId);
    if (idx !== -1) arr.splice(idx, 1);
  }
  const total =
    next.boxIds.length + next.doorIds.length + next.openingIds.length + next.applianceIds.length;
  return total > 0 ? next : undefined;
}

export const Scene3DCanvas: React.FC<Scene3DCanvasProps> = (props) => {
  const { project, tool } = props;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [camPreset, setCamPreset] = useState<'iso' | 'front' | 'top'>('iso');
  const [hoverPreview, setHoverPreview] = useState<{
    clientX: number;
    clientY: number;
    hoverTarget: 'cabinet' | 'backsplash' | 'countertop' | null;
  } | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const builtRef = useRef<BuiltKitchenScene | null>(null);
  const ghostGroupRef = useRef<THREE.Group | null>(null);
  const requestRenderRef = useRef<() => void>(() => {});
  const drag3DRef = useRef<Drag3D | null>(null);
  const downClientRef = useRef<{ x: number; y: number } | null>(null);
  const lastHoverCheckRef = useRef<{ x: number; y: number; ts: number }>({ x: 0, y: 0, ts: 0 });
  const camInitDoneRef = useRef(false);

  const propsRef = useRef(props);
  propsRef.current = props;
  const doorsOpenRef = useRef(doorsOpen);
  doorsOpenRef.current = doorsOpen;

  const applyCameraPreset = (preset: 'iso' | 'front' | 'top', bounds?: THREE.Box3) => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    const b = bounds || builtRef.current?.bounds;
    if (!cam || !ctrl || !b) return;

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    b.getCenter(center);
    b.getSize(size);
    const maxDim = Math.max(3.2, size.x, size.z, size.y);

    ctrl.target.set(center.x, Math.max(0.9, center.y * 0.65), center.z);
    if (preset === 'top') {
      cam.position.set(center.x, maxDim * 1.45, center.z + 0.01);
    } else if (preset === 'front') {
      const aw =
        propsRef.current.project.walls.find((w) => w.id === propsRef.current.project.activeWallId) ||
        propsRef.current.project.walls[0];
      const tr = aw ? builtRef.current?.wallTransforms.get(aw.id) : null;
      if (tr) {
        const mid = tr.origin.clone().addScaledVector(tr.tangent, (tr.lengthCm * CM) / 2);
        mid.y = tr.heightCm * CM * 0.48;
        ctrl.target.copy(mid);
        const dist = Math.max(2.6, tr.lengthCm * CM * 0.95);
        cam.position.copy(mid).addScaledVector(tr.normal, dist);
        cam.position.y = mid.y + 0.25;
      } else {
        cam.position.set(center.x, 1.35, center.z + maxDim * 1.1);
      }
    } else {
      const aw =
        propsRef.current.project.walls.find((w) => w.id === propsRef.current.project.activeWallId) ||
        propsRef.current.project.walls[0];
      const tr = aw ? builtRef.current?.wallTransforms.get(aw.id) : null;
      if (tr) {
        const dist = Math.max(3.4, maxDim * 0.92);
        cam.position
          .copy(center)
          .addScaledVector(tr.normal, dist * 0.85)
          .addScaledVector(tr.tangent, -dist * 0.42);
        cam.position.y = Math.max(2.2, maxDim * 0.62);
      } else {
        cam.position.set(center.x + maxDim * 0.75, Math.max(2.2, maxDim * 0.65), center.z + maxDim * 0.85);
      }
    }
    cam.updateProjectionMatrix();
    ctrl.update();
    requestRenderRef.current();
  };

  useEffect(() => {
    const container = hostRef.current;
    if (!container) return;

    const w = Math.max(320, container.clientWidth);
    const h = Math.max(240, container.clientHeight);

    const probeCanvas = document.createElement('canvas');
    const glProbe =
      (probeCanvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (probeCanvas.getContext('webgl') as WebGLRenderingContext | null);
    const isSoftwareGl = detectSoftwareWebGL(glProbe);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    if (!isSoftwareGl) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    renderer.domElement.setAttribute('data-testid', 'scene-3d-canvas');
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eaeef3');
    scene.fog = new THREE.Fog('#eaeef3', 14, 34);
    sceneRef.current = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.52;

    const hemi = new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 0.56);
    scene.add(hemi);

    const dirKey = new THREE.DirectionalLight(0xfffbeb, 1.05);
    dirKey.position.set(4.5, 6.8, 5.2);
    if (!isSoftwareGl) {
      dirKey.castShadow = true;
      dirKey.shadow.mapSize.set(1024, 1024);
      dirKey.shadow.camera.near = 0.5;
      dirKey.shadow.camera.far = 22;
      dirKey.shadow.camera.left = -6;
      dirKey.shadow.camera.right = 6;
      dirKey.shadow.camera.top = 6;
      dirKey.shadow.camera.bottom = -6;
    }
    scene.add(dirKey);

    const dirFill = new THREE.DirectionalLight(0xe0f2fe, 0.36);
    dirFill.position.set(-4, 3.5, -4);
    scene.add(dirFill);

    // Reusable 3D ghost preview group + materials
    const ghostGroup = new THREE.Group();
    ghostGroup.visible = false;
    scene.add(ghostGroup);
    ghostGroupRef.current = ghostGroup;

    const ghostMatIndigo = new THREE.MeshStandardMaterial({
      color: 0x4f46e5,
      transparent: true,
      opacity: 0.34,
      roughness: 0.35,
      depthWrite: false,
    });
    const ghostMatTeal = new THREE.MeshStandardMaterial({
      color: 0x0f766e,
      transparent: true,
      opacity: 0.38,
      roughness: 0.32,
      depthWrite: false,
    });
    const ghostMatDanger = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      transparent: true,
      opacity: 0.38,
      roughness: 0.35,
      depthWrite: false,
    });
    const ghostMatWire = new THREE.LineBasicMaterial({ color: 0x312e81 });

    const camera = new THREE.PerspectiveCamera(44, w / h, 0.1, 80);
    camera.position.set(3.2, 2.5, 3.8);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = 0.9;
    controls.maxDistance = 18;
    controlsRef.current = controls;

    let rafId: number | null = null;
    let needsRender = true;
    const renderLoop = () => {
      rafId = null;
      if (controls.enableDamping) {
        if (controls.update()) needsRender = true;
      }
      if (needsRender) {
        needsRender = false;
        renderer.render(scene, camera);
      }
    };
    const requestRender = () => {
      needsRender = true;
      if (rafId === null) {
        rafId = requestAnimationFrame(renderLoop);
      }
    };
    requestRenderRef.current = requestRender;

    controls.addEventListener('change', requestRender);

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr || cr.width < 10 || cr.height < 10) return;
      camera.aspect = cr.width / cr.height;
      camera.updateProjectionMatrix();
      renderer.setSize(cr.width, cr.height);
      requestRender();
    });
    ro.observe(container);

    // Scratch math objects to minimize allocations in pointermove/wheel
    const raycaster = new THREE.Raycaster();
    const ndcVec = new THREE.Vector2();
    const scratchPlane = new THREE.Plane();
    const scratchHit = new THREE.Vector3();
    const scratchRel = new THREE.Vector3();
    const upAxis = new THREE.Vector3(0, 1, 0);
    const basisMat = new THREE.Matrix4();

    const setNdc = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndcVec.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      return ndcVec;
    };

    const projectPointerOntoWall = (wallId: string, clientX: number, clientY: number) => {
      const tr = builtRef.current?.wallTransforms.get(wallId);
      if (!tr) return null;
      raycaster.setFromCamera(setNdc(clientX, clientY), camera);
      scratchPlane.setFromNormalAndCoplanarPoint(tr.normal, tr.origin);
      if (!raycaster.ray.intersectPlane(scratchPlane, scratchHit)) return null;
      scratchRel.copy(scratchHit).sub(tr.origin);
      const xCm = scratchRel.dot(tr.tangent) / CM;
      const yCm = scratchHit.y / CM;
      return { xCm, yCm, tr };
    };

    const clearGhost = () => {
      while (ghostGroup.children.length > 0) {
        const ch = ghostGroup.children[0];
        ghostGroup.remove(ch);
        const m = ch as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      }
      if (ghostGroup.visible) {
        ghostGroup.visible = false;
        requestRender();
      }
    };

    const updateGhostAndHover = (clientX: number, clientY: number) => {
      if (!builtRef.current) {
        clearGhost();
        return;
      }
      raycaster.setFromCamera(setNdc(clientX, clientY), camera);
      const hits = raycaster.intersectObjects(builtRef.current.interactables, false);
      if (!hits.length) {
        clearGhost();
        setHoverPreview((prev) => (prev ? null : prev));
        return;
      }
      const topHit = hits[0];
      const data = resolveHitData(topHit.object);
      if (!data) {
        clearGhost();
        return;
      }

      const cur = propsRef.current;
      const wall = cur.project.walls.find((x) => x.id === data.wallId);
      const tr = builtRef.current.wallTransforms.get(data.wallId);
      if (!wall || !tr) {
        clearGhost();
        return;
      }

      scratchRel.copy(topHit.point).sub(tr.origin);
      const hitXCm = Math.max(0, Math.min(wall.length, scratchRel.dot(tr.tangent) / CM));
      const hitYCm = Math.max(0, Math.min(wall.height, topHit.point.y / CM));

      let finishTarget: 'cabinet' | 'backsplash' | 'countertop' | null = null;
      if (cur.tool === 'finish') {
        finishTarget =
          data.kind === 'countertop'
            ? 'countertop'
            : data.kind === 'backsplash'
            ? 'backsplash'
            : data.boxId
            ? 'cabinet'
            : null;
      }

      setHoverPreview({ clientX, clientY, hoverTarget: finishTarget });

      // Update translucent 3D ghost mesh on hovered wall
      while (ghostGroup.children.length > 0) {
        const ch = ghostGroup.children[0];
        ghostGroup.remove(ch);
        const m = ch as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      }

      ghostGroup.position.copy(tr.origin);
      basisMat.makeBasis(tr.tangent, upAxis, tr.normal);
      ghostGroup.quaternion.setFromRotationMatrix(basisMat);

      const addGhostBox = (
        x1Cm: number,
        y1Cm: number,
        z1Cm: number,
        wCm: number,
        hCm: number,
        dCm: number,
        mat: THREE.Material
      ) => {
        const geo = new THREE.BoxGeometry(Math.max(0.02, wCm * CM), Math.max(0.02, hCm * CM), Math.max(0.015, dCm * CM));
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set((x1Cm + wCm / 2) * CM, (y1Cm + hCm / 2) * CM, (z1Cm + dCm / 2) * CM);
        ghostGroup.add(mesh);
        const edges = new THREE.EdgesGeometry(geo);
        const line = new THREE.LineSegments(edges, ghostMatWire);
        line.position.copy(mesh.position);
        ghostGroup.add(line);
      };

      let hasGhost = false;
      if (cur.tool === 'cab-draw') {
        const preset = BOX_PRESETS[cur.drawBoxKind] || BOX_PRESETS.base;
        const wCm = 120;
        const startCm = Math.max(0, Math.min(wall.length - wCm, Math.round((hitXCm - wCm / 2) / 5) * 5));
        addGhostBox(startCm, preset.elevY, 0, wCm, preset.height, preset.depth, ghostMatIndigo);
        hasGhost = true;
      } else if (cur.tool === 'fridge') {
        const cfg = FRIDGE_MODELS[cur.fridgeModel];
        const fw = cfg.width + FRIDGE_FRAME_CM * 2;
        const fh = cfg.height + FRIDGE_FRAME_CM;
        const startCm = Math.max(0, Math.min(wall.length - fw, Math.round((hitXCm - fw / 2) / 5) * 5));
        addGhostBox(startCm, 0, 0, fw, fh, cfg.depth, ghostMatIndigo);
        hasGhost = true;
      } else if (cur.tool === 'opening') {
        const def = OPENING_DEFAULTS[cur.openingKind];
        const elev = cur.openingKind === 'window' ? Math.max(20, Math.round(hitYCm - def.height / 2)) : 0;
        const startCm = Math.max(0, Math.min(wall.length - def.width, Math.round((hitXCm - def.width / 2) / 5) * 5));
        addGhostBox(startCm, elev, -2, def.width, def.height, 14, ghostMatTeal);
        hasGhost = true;
      } else if (cur.tool === 'sink' || cur.tool === 'gas' || cur.tool === 'appliance') {
        const baseBox =
          (data.boxId ? wall.boxes.find((b) => b.id === data.boxId && b.type === 'base') : undefined) ||
          wall.boxes.find((b) => b.type === 'base' && hitXCm >= b.offsetX - 5 && hitXCm <= b.offsetX + b.width + 5);
        if (baseBox) {
          const kind = cur.tool === 'sink' ? 'sink' : cur.tool === 'gas' ? 'gas' : cur.applianceKind;
          const tw =
            kind === 'sink'
              ? SINK_MODELS[cur.sinkModel].width
              : kind === 'gas'
              ? cur.gasWidth
              : APPLIANCE_CONFIGS[kind].width;
          const startCm = Math.max(
            baseBox.offsetX,
            Math.min(baseBox.offsetX + baseBox.width - tw, Math.round((hitXCm - tw / 2) / 5) * 5)
          );
          const topY = baseBox.elevY + baseBox.height;
          if (kind === 'sink' || kind === 'gas') {
            addGhostBox(startCm, topY - 1, 6, tw, 12, 48, ghostMatTeal);
          } else {
            addGhostBox(startCm, baseBox.plinth, 0, tw, topY - baseBox.countertopCm - baseBox.plinth, baseBox.depth + 2, ghostMatIndigo);
          }
          hasGhost = true;
        }
      } else if (cur.tool === 'doors' && data.boxId) {
        const box = wall.boxes.find((b) => b.id === data.boxId);
        if (box && box.type !== 'fridge') {
          const blockedZones = getCornerBlockedZonesForWall(wall, cur.project.walls, cur.project.cornerOwners);
          const prev = computeDoorBrushPreview(
            box,
            hitXCm - box.offsetX,
            cur.doorOrient,
            cur.doorVertCount,
            cur.drawerPatIdx,
            cur.liftPatIdx,
            blockedZones,
            cur.doorTargetWidth
          );
          if (prev.ok) {
            for (const it of prev.items) {
              addGhostBox(
                box.offsetX + it.startCm + 0.5,
                box.elevY + box.plinth + 0.5,
                box.depth + 0.5,
                Math.max(4, it.widthCm - 1),
                Math.max(10, box.height - box.plinth - box.countertopCm - 1),
                2.5,
                ghostMatIndigo
              );
            }
          } else {
            addGhostBox(
              hitXCm - 15,
              box.elevY + box.plinth + 4,
              box.depth + 1,
              30,
              Math.max(16, box.height - box.plinth - box.countertopCm - 8),
              2.5,
              ghostMatDanger
            );
          }
          hasGhost = true;
        }
      } else if (cur.tool === 'finish' && data.boxId) {
        const box = wall.boxes.find((b) => b.id === data.boxId);
        if (box) {
          addGhostBox(box.offsetX, box.elevY, 0, box.width, box.height, box.depth + 3, ghostMatIndigo);
          hasGhost = true;
        }
      }

      ghostGroup.visible = hasGhost;
      requestRender();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || !builtRef.current) return;
      downClientRef.current = { x: e.clientX, y: e.clientY };

      raycaster.setFromCamera(setNdc(e.clientX, e.clientY), camera);
      const hits = raycaster.intersectObjects(builtRef.current.interactables, false);
      if (!hits.length) return;

      const topHit = hits[0];
      const data = resolveHitData(topHit.object);
      if (!data) return;

      const cur = propsRef.current;
      const wall = cur.project.walls.find((x) => x.id === data.wallId);
      if (!wall) return;

      const wallProj = projectPointerOntoWall(data.wallId, e.clientX, e.clientY);

      if (data.kind === 'appliance' && data.appId && wallProj) {
        const app = wall.appliances.find((a) => a.id === data.appId);
        const canDragApp =
          app &&
          (cur.tool === 'select' ||
            (cur.tool === 'gas' && app.kind === 'gas') ||
            (cur.tool === 'sink' && app.kind === 'sink') ||
            (cur.tool === 'appliance' && (app.kind === 'dishwasher' || app.kind === 'washing')));
        if (canDragApp && app) {
          cur.onSelectAppliance(wall.id, app.id);
          controls.enabled = false;
          drag3DRef.current = {
            kind: 'move-app',
            wallId: wall.id,
            appId: app.id,
            origX: app.offsetX,
            lastTargetX: app.offsetX,
            startDot: wallProj.xCm,
            sessionId: `3dapp_${Date.now()}`,
          };
          return;
        }
      }

      if (cur.tool === 'select') {
        if (data.kind === 'box-handle' && data.boxId && data.handleSide && wallProj) {
          const box = wall.boxes.find((b) => b.id === data.boxId);
          if (box) {
            controls.enabled = false;
            drag3DRef.current = {
              kind: 'resize-box',
              wallId: wall.id,
              boxId: box.id,
              side: data.handleSide,
              origX: box.offsetX,
              origW: box.width,
              origElev: box.elevY,
              origH: box.height,
              lastElev: box.elevY,
              lastH: box.height,
              startDot: wallProj.xCm,
              startY: wallProj.yCm,
            };
          }
          return;
        }
        if (data.kind === 'unit' && data.boxId && data.unitStart !== undefined && data.unitEnd !== undefined) {
          cur.onSelectUnit(wall.id, { boxId: data.boxId, startCm: data.unitStart, endCm: data.unitEnd });
          return;
        }
        if (data.kind === 'unit-div' && data.boxId && data.seamCm !== undefined) {
          cur.onSelectUnitDivider(wall.id, { boxId: data.boxId, seamCm: data.seamCm });
          return;
        }
        if (data.kind === 'frame' && data.boxId && data.frameId) {
          cur.onSelectFrame(wall.id, data.boxId, data.frameId);
          return;
        }
        if (data.kind === 'shelf' && data.boxId && data.shelfId) {
          cur.onSelectShelf(wall.id, data.boxId, data.shelfId);
          return;
        }
        if (data.kind === 'handle' && data.boxId && data.handleId) {
          cur.onSelectHandle(wall.id, data.boxId, data.handleId);
          return;
        }
        if (data.kind === 'opening' && data.openingId) {
          cur.onSelectOpening(wall.id, data.openingId);
          return;
        }
        if ((data.kind === 'box' || data.kind === 'door') && data.boxId) {
          const box = wall.boxes.find((b) => b.id === data.boxId);
          if (cur.selectionMode !== 'single') {
            const nextSel = data.doorId
              ? applySelectionMode3D(cur.project.multiSelection, cur.selectionMode, 'door', data.doorId)
              : applySelectionMode3D(cur.project.multiSelection, cur.selectionMode, 'box', data.boxId);
            cur.onSetMultiSelection(nextSel);
            cur.onSelectWallAndBox(
              wall.id,
              data.boxId,
              cur.selectionMode === 'subtract' ? null : data.doorId ?? null,
              true
            );
            return;
          }

          cur.onSelectWallAndBox(wall.id, data.boxId, data.doorId ?? null);
          if (box && wallProj) {
            controls.enabled = false;
            drag3DRef.current = {
              kind: 'move-box',
              wallId: wall.id,
              boxId: box.id,
              origX: box.offsetX,
              lastTargetX: box.offsetX,
              startDot: wallProj.xCm,
              sessionId: `3dbox_${Date.now()}`,
            };
          }
          return;
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const dr = drag3DRef.current;
      if (!dr) {
        if (e.buttons === 0 && e.target === renderer.domElement) {
          const now = performance.now();
          const last = lastHoverCheckRef.current;
          if (now - last.ts >= 32 || Math.hypot(e.clientX - last.x, e.clientY - last.y) >= 12) {
            lastHoverCheckRef.current = { x: e.clientX, y: e.clientY, ts: now };
            updateGhostAndHover(e.clientX, e.clientY);
          }
        } else if (e.buttons !== 0) {
          setHoverPreview((prev) => (prev ? null : prev));
        }
        return;
      }

      const proj = projectPointerOntoWall(dr.wallId, e.clientX, e.clientY);
      if (!proj) return;
      const cur = propsRef.current;

      if (dr.kind === 'move-box') {
        const dx = Math.round((proj.xCm - dr.startDot) / 5) * 5;
        const target = dr.origX + dx;
        dr.lastTargetX = target;
        cur.onMoveBox(dr.wallId, dr.boxId, target, false, dr.sessionId);
      } else if (dr.kind === 'move-app') {
        const dx = Math.round((proj.xCm - dr.startDot) / 5) * 5;
        const target = dr.origX + dx;
        dr.lastTargetX = target;
        cur.onMoveAppliance(dr.wallId, dr.appId, target, false, dr.sessionId);
      } else if (dr.kind === 'resize-box') {
        const dx = Math.round(proj.xCm - dr.startDot);
        const dy = Math.round(proj.yCm - dr.startY);
        const wall = cur.project.walls.find((x) => x.id === dr.wallId);
        const box = wall?.boxes.find((b) => b.id === dr.boxId);
        if (!wall || !box) return;

        if ((box.type === 'wall' || box.type === 'wall-deep') && (dr.side === 'top' || dr.side === 'bottom')) {
          let nextElev = dr.origElev;
          let nextH = dr.origH;
          if (dr.side === 'top') {
            nextH = Math.max(25, Math.min(wall.height - dr.origElev, dr.origH + dy));
          } else {
            nextElev = Math.max(95, Math.min(dr.origElev + dr.origH - 25, dr.origElev + dy));
            nextH = dr.origH + (dr.origElev - nextElev);
          }
          dr.lastElev = nextElev;
          dr.lastH = nextH;
          cur.onResizeWallBoxesSynced(dr.wallId, dr.boxId, nextElev, nextH, false);
          return;
        }

        cur.onMutateWallById(
          dr.wallId,
          (w) => {
            const b = w.boxes.find((x) => x.id === dr.boxId);
            if (!b) return;
            if (dr.side === 'right') {
              b.width = Math.max(40, Math.min(w.length - b.offsetX, dr.origW + dx));
            } else if (dr.side === 'left') {
              const newOff = Math.max(0, Math.min(dr.origX + dr.origW - 40, dr.origX + dx));
              b.width = dr.origW + (dr.origX - newOff);
              b.offsetX = newOff;
            } else if (dr.side === 'top') {
              b.height = Math.max(40, Math.min(w.height - b.elevY, dr.origH + dy));
            }
            clampBoxInternalsAfterResize(b);
          },
          false
        );
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const dr = drag3DRef.current;
      drag3DRef.current = null;
      controls.enabled = true;

      const cur = propsRef.current;
      if (dr) {
        if (dr.kind === 'move-box' && dr.lastTargetX !== dr.origX) {
          cur.onMoveBox(dr.wallId, dr.boxId, dr.lastTargetX, true, dr.sessionId);
        } else if (dr.kind === 'move-app' && dr.lastTargetX !== dr.origX) {
          cur.onMoveAppliance(dr.wallId, dr.appId, dr.lastTargetX, true, dr.sessionId);
        } else if (dr.kind === 'resize-box') {
          const wall = cur.project.walls.find((x) => x.id === dr.wallId);
          const box = wall?.boxes.find((b) => b.id === dr.boxId);
          if (box && (box.type === 'wall' || box.type === 'wall-deep') && (dr.side === 'top' || dr.side === 'bottom')) {
            cur.onResizeWallBoxesSynced(dr.wallId, dr.boxId, dr.lastElev, dr.lastH, true);
          } else {
            cur.onMutateWallById(dr.wallId, () => {}, true);
          }
        }
        return;
      }

      const dc = downClientRef.current;
      downClientRef.current = null;
      if (!dc || Math.hypot(e.clientX - dc.x, e.clientY - dc.y) > 6 || !builtRef.current) return;

      raycaster.setFromCamera(setNdc(e.clientX, e.clientY), camera);
      const hits = raycaster.intersectObjects(builtRef.current.interactables, false);
      if (!hits.length) {
        if (cur.tool === 'doors') {
          const nextOrient: Orientation = cur.doorOrient === 'vertical' ? 'horizontal' : 'vertical';
          cur.onSetDoorOrient?.(nextOrient);
          cur.onToast(`جهت براش درب: ${nextOrient === 'vertical' ? 'عمودی (درب)' : 'افقی (کشو / جک‌دار)'}`);
        } else if (cur.tool === 'handle') {
          const nextOrient: Orientation = cur.handleOrient === 'vertical' ? 'horizontal' : 'vertical';
          cur.onSetHandleOrient?.(nextOrient);
          cur.onToast(`جهت دستگیره: ${nextOrient === 'vertical' ? 'عمودی' : 'افقی'}`);
        } else if (cur.tool === 'select') {
          cur.onSelectWallAndBox(cur.project.activeWallId || '', null, null);
        }
        return;
      }
      const topHit = hits[0];
      const data = resolveHitData(topHit.object);
      if (!data) return;
      const wall = cur.project.walls.find((x) => x.id === data.wallId);
      const tr = builtRef.current.wallTransforms.get(data.wallId);
      if (!wall || !tr) return;

      if (cur.tool === 'select') {
        if (data.kind === 'wall' || data.kind === 'backsplash' || data.kind === 'countertop') {
          cur.onSelectWallAndBox(wall.id, null, null);
        }
        return;
      }

      scratchRel.copy(topHit.point).sub(tr.origin);
      const hitXCm = Math.max(0, Math.min(wall.length, scratchRel.dot(tr.tangent) / CM));
      const hitYCm = Math.max(0, Math.min(wall.height, topHit.point.y / CM));

      if (cur.tool === 'cab-draw') {
        const wCm = 120;
        const startCm = Math.max(0, Math.min(wall.length - wCm, Math.round((hitXCm - wCm / 2) / 5) * 5));
        const box = createEmptyBox(cur.drawBoxKind, startCm, wCm, { settings: cur.project.settings });
        cur.onMutateWallById(
          wall.id,
          (w) => {
            w.boxes.push(box);
          },
          true,
          `باکس ${box.name} در نمای سه‌بعدی اضافه شد`
        );
        cur.onSelectWallAndBox(wall.id, box.id, null);
        return;
      }

      if (cur.tool === 'fridge') {
        const cfg = FRIDGE_MODELS[cur.fridgeModel];
        cur.onPlaceFridge(wall.id, hitXCm - cfg.width / 2);
        return;
      }

      if (cur.tool === 'opening') {
        const def = OPENING_DEFAULTS[cur.openingKind];
        const elev = cur.openingKind === 'window' ? Math.max(20, Math.round(hitYCm - def.height / 2)) : 0;
        cur.onPlaceOpening(wall.id, hitXCm - def.width / 2, elev);
        return;
      }

      if (cur.tool === 'sink' || cur.tool === 'gas' || cur.tool === 'appliance') {
        let baseBox = data.boxId ? wall.boxes.find((b) => b.id === data.boxId && b.type === 'base') : undefined;
        if (!baseBox) {
          baseBox = wall.boxes.find(
            (b) => b.type === 'base' && hitXCm >= b.offsetX - 5 && hitXCm <= b.offsetX + b.width + 5
          );
        }
        if (!baseBox) {
          cur.onToast('لطفاً روی یک باکس زمینی کلیک کنید');
          return;
        }
        const k: ApplianceKind =
          cur.tool === 'sink' ? 'sink' : cur.tool === 'gas' ? 'gas' : cur.applianceKind;
        const tw =
          k === 'sink' ? SINK_MODELS[cur.sinkModel].width : k === 'gas' ? cur.gasWidth : APPLIANCE_CONFIGS[k].width;
        cur.onPlaceAppliance(wall.id, baseBox.id, hitXCm - tw / 2, k);
        return;
      }

      if (cur.tool === 'doors') {
        if (cur.project.doorsLocked) {
          cur.onToast('درب‌ها قفل هستند؛ قفل را باز کنید');
          return;
        }
        if (!data.boxId) {
          const nextOrient: Orientation = cur.doorOrient === 'vertical' ? 'horizontal' : 'vertical';
          cur.onSetDoorOrient?.(nextOrient);
          cur.onToast(`جهت براش درب: ${nextOrient === 'vertical' ? 'عمودی (درب)' : 'افقی (کشو / جک‌دار)'}`);
          return;
        }
        const box = wall.boxes.find((b) => b.id === data.boxId);
        if (!box || box.type === 'fridge') return;
        const blockedZones = getCornerBlockedZonesForWall(wall, cur.project.walls, cur.project.cornerOwners);
        const cursorCm = hitXCm - box.offsetX;
        const prev = computeDoorBrushPreview(
          box,
          cursorCm,
          cur.doorOrient,
          cur.doorVertCount,
          cur.drawerPatIdx,
          cur.liftPatIdx,
          blockedZones,
          cur.doorTargetWidth
        );
        if (!prev.ok) {
          cur.onToast(prev.reason || 'امکان درب‌گذاری نیست');
          return;
        }
        let selDoor: string | null = null;
        cur.onMutateWallById(
          wall.id,
          (w) => {
            const b = w.boxes.find((x) => x.id === box.id);
            if (!b) return;
            selDoor = applyDoorBrushPreview(b, cursorCm, prev).selectedDoorId;
          },
          true
        );
        cur.onSelectWallAndBox(wall.id, box.id, selDoor);
        return;
      }

      if (cur.tool === 'door-style') {
        if (cur.selectionMode !== 'single' && data.boxId && data.doorId) {
          const nextSel = applySelectionMode3D(
            cur.project.multiSelection,
            cur.selectionMode,
            'door',
            data.doorId
          );
          cur.onSetMultiSelection(nextSel);
          cur.onSelectWallAndBox(
            wall.id,
            data.boxId,
            cur.selectionMode === 'subtract' ? null : data.doorId,
            true
          );
          return;
        }
        if (cur.project.multiSelection && cur.project.multiSelection.doorIds.length > 0) {
          cur.onApplyDoorStyle(null, cur.project.multiSelection.doorIds, cur.doorStyleBrush);
          return;
        }
        if (data.boxId && data.doorId) {
          cur.onApplyDoorStyle(data.boxId, [data.doorId], cur.doorStyleBrush);
        } else if (data.boxId) {
          cur.onApplyDoorStyle(data.boxId, null, cur.doorStyleBrush);
        } else {
          const idx = Math.max(0, DOOR_STYLE_ORDER.indexOf(cur.doorStyleBrush));
          const nxt = DOOR_STYLE_ORDER[(idx + 1) % DOOR_STYLE_ORDER.length];
          cur.onSetDoorStyleBrush(nxt);
          cur.onToast(`مدل قلم: ${DOOR_STYLE_META[nxt].label}`);
        }
        return;
      }

      if (cur.tool === 'finish') {
        if (data.kind === 'countertop') {
          cur.onApplyFinish('countertop', wall.id);
          return;
        }
        if (data.kind === 'backsplash') {
          cur.onApplyFinish('backsplash', wall.id);
          return;
        }
        if (data.boxId) {
          cur.onApplyFinish('box', wall.id, data.boxId);
          cur.onSelectWallAndBox(wall.id, data.boxId, null);
          return;
        }
        const idx = Math.max(0, CABINET_FINISH_ORDER.indexOf(cur.cabinetFinishBrush));
        const nxt = CABINET_FINISH_ORDER[(idx + 1) % CABINET_FINISH_ORDER.length];
        cur.onSetCabinetFinishBrush(nxt);
        cur.onToast(`رنگ قلم: ${CABINET_FINISHES[nxt].label}`);
        return;
      }

      if (cur.tool === 'pencil' || cur.tool === 'skeleton') {
        if (!data.boxId) return;
        const box = wall.boxes.find((b) => b.id === data.boxId);
        if (!box || box.type === 'fridge') return;
        const blockedZones = getCornerBlockedZonesForWall(wall, cur.project.walls, cur.project.cornerOwners);
        const clickCm = hitXCm - box.offsetX;
        let seam: number | null = null;
        for (const d of box.doors) {
          if (d.startCm > 2 && Math.abs(clickCm - d.startCm) < 8) seam = d.startCm;
          const endCm = d.startCm + d.widthCm;
          if (endCm < box.width - 2 && Math.abs(clickCm - endCm) < 8) seam = endCm;
        }
        for (const u of box.unitDividers) {
          if (Math.abs(clickCm - u) < 8) seam = u;
        }
        if (seam !== null) {
          const sv = +seam.toFixed(1);
          const hasDiv = box.unitDividers.some((u) => Math.abs(u - sv) < 1.5);
          cur.onMutateWallById(
            wall.id,
            (w) => {
              const b = w.boxes.find((x) => x.id === box.id);
              if (!b) return;
              if (hasDiv) removeUnitDividerWithSync(b, sv, blockedZones);
              else {
                b.unitDividers.push(sv);
                b.unitDividers.sort((a, c) => a - c);
              }
            },
            true,
            hasDiv ? 'دیواره یونیت برداشته شد' : 'دیواره یونیت (32mm) ثبت شد'
          );
        } else {
          const units = getUnitsInBox(box, blockedZones);
          const u = units.find((x) => clickCm >= x.startCm - 0.5 && clickCm <= x.endCm + 0.5);
          if (!u || !u.canHaveShelves) {
            cur.onToast(u?.blockedReason || 'امکان طبقه‌گذاری نیست');
            return;
          }
          cur.onMutateWallById(
            wall.id,
            (w) => {
              const b = w.boxes.find((x) => x.id === box.id);
              if (!b) return;
              for (let i = 1; i <= cur.shelfCount; i++) {
                b.shelves.push({
                  id: uid('sh'),
                  startCm: u.startCm,
                  endCm: u.endCm,
                  yRatio: +(i / (cur.shelfCount + 1)).toFixed(2),
                });
              }
            },
            true,
            `${cur.shelfCount} طبقه اضافه شد`
          );
        }
        return;
      }

      if (cur.tool === 'frame' && data.boxId) {
        const box = wall.boxes.find((b) => b.id === data.boxId);
        if (!box) return;
        const clickCm = hitXCm - box.offsetX;
        const blockedZones = getCornerBlockedZonesForWall(wall, cur.project.walls, cur.project.cornerOwners);
        const exposure = getBoxSideExposure(box, wall, cur.project.walls, cur.project.cornerOwners, blockedZones);
        const topEdge = box.elevY + box.height;
        const botEdge = box.elevY + box.plinth;
        let side: 'left' | 'right' | 'top' | 'bottom' | 'seam' = 'top';
        let seamCm: number | undefined;
        if (Math.abs(clickCm) <= 10) side = 'left';
        else if (Math.abs(box.width - clickCm) <= 10) side = 'right';
        else if (Math.abs(topEdge - hitYCm) <= 12) side = 'top';
        else if (Math.abs(hitYCm - botEdge) <= 12) side = 'bottom';
        else {
          side = 'seam';
          seamCm = clickCm;
        }
        let msg = '';
        cur.onMutateWallById(
          wall.id,
          (w) => {
            const b = w.boxes.find((x) => x.id === box.id);
            if (b) msg = placeFrameOnBox(b, side, cur.frameWidthCm, seamCm, exposure).message;
          },
          true
        );
        if (msg) cur.onToast(msg);
        return;
      }

      if (cur.tool === 'handle') {
        if (!data.boxId || !data.doorId) {
          const nextOrient: Orientation = cur.handleOrient === 'vertical' ? 'horizontal' : 'vertical';
          cur.onSetHandleOrient?.(nextOrient);
          cur.onToast(`جهت دستگیره: ${nextOrient === 'vertical' ? 'عمودی' : 'افقی'}`);
          return;
        }
        if (cur.selectionMode !== 'single') {
          const nextSel = applySelectionMode3D(
            cur.project.multiSelection,
            cur.selectionMode,
            'door',
            data.doorId
          );
          cur.onSetMultiSelection(nextSel);
          cur.onSelectWallAndBox(
            wall.id,
            data.boxId,
            cur.selectionMode === 'subtract' ? null : data.doorId,
            true
          );
          return;
        }
        const box = wall.boxes.find((b) => b.id === data.boxId);
        if (!box) return;
        const blockedZones = getCornerBlockedZonesForWall(wall, cur.project.walls, cur.project.cornerOwners);
        cur.onMutateWallById(
          wall.id,
          (w) => {
            const b = w.boxes.find((x) => x.id === box.id);
            if (!b) return;
            autoUnitizeBoxForHandles(b, blockedZones);
            b.handles = b.handles.filter((h) => !(h.doorId === data.doorId && h.rowIndex === 0));
            const door = b.doors.find((d) => d.id === data.doorId);
            const hItem: HandleItem = {
              id: uid('hand'),
              doorId: data.doorId!,
              rowIndex: 0,
              xRatio: door?.hingeSide === 'right' ? 0.14 : 0.86,
              yRatio: b.type === 'wall' || b.type === 'wall-deep' ? 0.82 : 0.18,
              orient: cur.handleOrient,
              style: cur.handleStyle,
              lengthCm: 16,
            };
            b.handles.push(hItem);
          },
          true,
          'دستگیره نصب شد'
        );
        return;
      }

      if (cur.tool === 'eraser') {
        if (data.kind === 'opening' && data.openingId) {
          cur.onDeleteOpening(wall.id, data.openingId);
        } else if (data.kind === 'appliance' && data.appId) {
          cur.onMutateWallById(
            wall.id,
            (w) => deleteApplianceHierarchically(w, data.appId!),
            true,
            'تجهیز حذف شد'
          );
        } else if (data.kind === 'handle' && data.boxId && data.handleId) {
          cur.onMutateWallById(
            wall.id,
            (w) => {
              const b = w.boxes.find((x) => x.id === data.boxId);
              if (b) b.handles = b.handles.filter((h) => h.id !== data.handleId);
            },
            true,
            'دستگیره حذف شد'
          );
        } else if (data.kind === 'frame' && data.boxId && data.frameId) {
          cur.onMutateWallById(
            wall.id,
            (w) => {
              const b = w.boxes.find((x) => x.id === data.boxId);
              if (b && b.frames) b.frames = b.frames.filter((f) => f.id !== data.frameId);
            },
            true,
            'فریم حذف شد'
          );
        } else if (data.kind === 'shelf' && data.boxId && data.shelfId) {
          cur.onMutateWallById(
            wall.id,
            (w) => {
              const b = w.boxes.find((x) => x.id === data.boxId);
              if (b) b.shelves = b.shelves.filter((s) => s.id !== data.shelfId);
            },
            true,
            'طبقه حذف شد'
          );
        } else if (data.kind === 'unit-div' && data.boxId && data.seamCm !== undefined) {
          const blockedZones = getCornerBlockedZonesForWall(wall, cur.project.walls, cur.project.cornerOwners);
          cur.onMutateWallById(
            wall.id,
            (w) => {
              const b = w.boxes.find((x) => x.id === data.boxId);
              if (b) removeUnitDividerWithSync(b, data.seamCm!, blockedZones);
            },
            true,
            'دیواره یونیت حذف شد'
          );
        } else if (data.kind === 'door' && data.boxId && data.doorId) {
          if (cur.project.doorsLocked) {
            cur.onToast('درب‌ها قفل هستند');
            return;
          }
          cur.onMutateWallById(
            wall.id,
            (w) => {
              const b = w.boxes.find((x) => x.id === data.boxId);
              if (b) eraseDoorWithRule(b, data.doorId!);
            },
            true,
            'درب حذف شد'
          );
        } else if (data.kind === 'box' && data.boxId) {
          cur.onMutateWallById(
            wall.id,
            (w) => deleteBoxHierarchically(w, data.boxId!),
            true,
            'باکس حذف شد'
          );
        }
      }
    };

    const onWheelCapture = (e: WheelEvent) => {
      if (!builtRef.current) return;
      const cur = propsRef.current;
      raycaster.setFromCamera(setNdc(e.clientX, e.clientY), camera);
      const hits = raycaster.intersectObjects(builtRef.current.interactables, false);
      if (!hits.length) return;
      const data = resolveHitData(hits[0].object);
      if (!data) return;
      const wall = cur.project.walls.find((x) => x.id === data.wallId);
      if (!wall) return;

      const contextBox = data.boxId ? wall.boxes.find((b) => b.id === data.boxId) || null : null;
      const dir = e.deltaY < 0 ? 1 : -1;
      let consumed = false;

      if (cur.tool === 'doors' && contextBox && contextBox.type !== 'fridge') {
        if (cur.doorOrient === 'vertical') {
          cur.onSetDoorVertCount(Math.max(1, Math.min(4, cur.doorVertCount + dir)));
        } else if (contextBox.type === 'wall' || contextBox.type === 'wall-deep') {
          cur.onSetLiftPatIdx((cur.liftPatIdx + (dir > 0 ? 1 : LIFT_PATTERNS.length - 1)) % LIFT_PATTERNS.length);
        } else {
          cur.onSetDrawerPatIdx(
            (cur.drawerPatIdx + (dir > 0 ? 1 : DRAWER_PATTERNS.length - 1)) % DRAWER_PATTERNS.length
          );
        }
        consumed = true;
      } else if (cur.tool === 'sink' && contextBox && contextBox.type === 'base') {
        const idx = SINK_MODEL_ORDER.indexOf(cur.sinkModel);
        cur.onSetSinkModel(
          SINK_MODEL_ORDER[(idx + (dir > 0 ? 1 : SINK_MODEL_ORDER.length - 1)) % SINK_MODEL_ORDER.length]
        );
        consumed = true;
      } else if (cur.tool === 'gas' && contextBox && contextBox.type === 'base') {
        const widths = [...GAS_WIDTH_OPTIONS];
        const idx = Math.max(0, widths.indexOf(cur.gasWidth as (typeof GAS_WIDTH_OPTIONS)[number]));
        cur.onSetGasWidth(widths[(idx + (dir > 0 ? 1 : widths.length - 1)) % widths.length]);
        consumed = true;
      } else if (cur.tool === 'appliance' && contextBox && contextBox.type === 'base') {
        const idx = Math.max(0, APPLIANCE_ORDER.indexOf(cur.applianceKind));
        cur.onSetApplianceKind(
          APPLIANCE_ORDER[(idx + (dir > 0 ? 1 : APPLIANCE_ORDER.length - 1)) % APPLIANCE_ORDER.length]
        );
        consumed = true;
      } else if (cur.tool === 'fridge') {
        const idx = FRIDGE_MODEL_ORDER.indexOf(cur.fridgeModel);
        cur.onSetFridgeModel(
          FRIDGE_MODEL_ORDER[(idx + (dir > 0 ? 1 : FRIDGE_MODEL_ORDER.length - 1)) % FRIDGE_MODEL_ORDER.length]
        );
        consumed = true;
      } else if (cur.tool === 'opening') {
        const idx = OPENING_ORDER.indexOf(cur.openingKind);
        cur.onSetOpeningKind(
          OPENING_ORDER[(idx + (dir > 0 ? 1 : OPENING_ORDER.length - 1)) % OPENING_ORDER.length]
        );
        consumed = true;
      } else if (cur.tool === 'door-style') {
        const idx = Math.max(0, DOOR_STYLE_ORDER.indexOf(cur.doorStyleBrush));
        const nxt = DOOR_STYLE_ORDER[(idx + (dir > 0 ? 1 : DOOR_STYLE_ORDER.length - 1)) % DOOR_STYLE_ORDER.length];
        cur.onSetDoorStyleBrush(nxt);
        cur.onToast(`مدل درب: ${DOOR_STYLE_META[nxt].label}`);
        consumed = true;
      } else if (cur.tool === 'finish') {
        if (data.kind === 'countertop') {
          const idx = Math.max(0, COUNTERTOP_FINISH_ORDER.indexOf(cur.countertopBrush));
          const nxt =
            COUNTERTOP_FINISH_ORDER[(idx + (dir > 0 ? 1 : COUNTERTOP_FINISH_ORDER.length - 1)) % COUNTERTOP_FINISH_ORDER.length];
          cur.onSetCountertopBrush(nxt);
          cur.onToast(`صفحه: ${COUNTERTOP_FINISHES[nxt].label}`);
        } else if (data.kind === 'backsplash') {
          const idx = Math.max(0, BACKSPLASH_FINISH_ORDER.indexOf(cur.backsplashBrush));
          const nxt =
            BACKSPLASH_FINISH_ORDER[(idx + (dir > 0 ? 1 : BACKSPLASH_FINISH_ORDER.length - 1)) % BACKSPLASH_FINISH_ORDER.length];
          cur.onSetBacksplashBrush(nxt);
          cur.onToast(`کاشی بین‌کابینتی: ${BACKSPLASH_FINISHES[nxt].label}`);
        } else {
          const idx = Math.max(0, CABINET_FINISH_ORDER.indexOf(cur.cabinetFinishBrush));
          const nxt =
            CABINET_FINISH_ORDER[(idx + (dir > 0 ? 1 : CABINET_FINISH_ORDER.length - 1)) % CABINET_FINISH_ORDER.length];
          cur.onSetCabinetFinishBrush(nxt);
          cur.onToast(`رنگ کابینت: ${CABINET_FINISHES[nxt].label}`);
        }
        consumed = true;
      } else if ((cur.tool === 'pencil' || cur.tool === 'skeleton') && contextBox && contextBox.type !== 'fridge') {
        cur.onSetShelfCount(Math.max(1, Math.min(4, cur.shelfCount + dir)));
        consumed = true;
      } else if (cur.tool === 'frame') {
        const idx = Math.max(
          0,
          FRAME_WIDTH_OPTIONS.indexOf(cur.frameWidthCm as (typeof FRAME_WIDTH_OPTIONS)[number])
        );
        const nextIdx = Math.max(0, Math.min(FRAME_WIDTH_OPTIONS.length - 1, idx + dir));
        cur.onSetFrameWidthCm(FRAME_WIDTH_OPTIONS[nextIdx]);
        consumed = true;
      }

      if (consumed) {
        e.preventDefault();
        e.stopImmediatePropagation();
        requestAnimationFrame(() => updateGhostAndHover(e.clientX, e.clientY));
      }
    };

    const onPointerLeave = () => {
      clearGhost();
      setHoverPreview(null);
    };

    const dom = renderer.domElement;
    dom.addEventListener('wheel', onWheelCapture, { passive: false, capture: true });
    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onPointerLeave);
    window.addEventListener('blur', onPointerLeave);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      ro.disconnect();
      dom.removeEventListener('wheel', onWheelCapture, { capture: true });
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onPointerLeave);
      window.removeEventListener('blur', onPointerLeave);
      controls.removeEventListener('change', requestRender);
      controls.dispose();
      clearGhost();
      ghostMatIndigo.dispose();
      ghostMatTeal.dispose();
      ghostMatDanger.dispose();
      ghostMatWire.dispose();
      if (builtRef.current) {
        disposeObject3D(builtRef.current.root);
        builtRef.current = null;
      }
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (dom.parentNode === container) container.removeChild(dom);
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (builtRef.current) {
      scene.remove(builtRef.current.root);
      disposeObject3D(builtRef.current.root);
      builtRef.current = null;
    }

    const built = buildKitchen3DScene(project, {
      doorOpenProgress: doorsOpen ? 1 : 0,
    });
    builtRef.current = built;
    scene.add(built.root);

    if (!camInitDoneRef.current) {
      camInitDoneRef.current = true;
      applyCameraPreset('iso', built.bounds);
    } else {
      requestRenderRef.current();
    }
  }, [project, doorsOpen]);

  const handleSetCamPreset = (p: 'iso' | 'front' | 'top') => {
    setCamPreset(p);
    applyCameraPreset(p);
  };

  return (
    <div
      data-testid="scene-3d-root"
      className="relative w-full h-full bg-slate-100 overflow-hidden select-none"
    >
      <div ref={hostRef} className="w-full h-full" />

      {/* نوار شناور بالای نمای سه‌بعدی (دوربین، باز شدن درها، انتخاب دیوار) */}
      <div className="absolute top-2.5 right-3 left-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-20">
        <div className="pointer-events-auto flex items-center gap-1 bg-white/95 border border-slate-300 rounded-xl p-1 shadow-sm">
          <button
            type="button"
            onClick={() => handleSetCamPreset('iso')}
            className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition ${
              camPreset === 'iso'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            سه‌بعدی
          </button>
          <button
            type="button"
            onClick={() => handleSetCamPreset('front')}
            className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition ${
              camPreset === 'front'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            روبرومی دیوار
          </button>
          <button
            type="button"
            onClick={() => handleSetCamPreset('top')}
            className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition ${
              camPreset === 'top'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            بالا (پلان)
          </button>

          <div className="w-px h-4 bg-slate-200 mx-0.5" />

          <button
            type="button"
            onClick={() => setDoorsOpen((v) => !v)}
            aria-pressed={doorsOpen}
            title="باز و بسته کردن درب‌ها در نمای سه‌بعدی"
            className={`h-7 px-2.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition ${
              doorsOpen
                ? 'bg-amber-500 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {doorsOpen ? <DoorOpen className="w-3.5 h-3.5" /> : <DoorClosed className="w-3.5 h-3.5" />}
            <span>{doorsOpen ? 'درب‌ها باز' : 'درب‌ها بسته'}</span>
          </button>
        </div>

        {/* انتخاب دیوار فعال + نشانگر ابزار فعال در سه‌بعدی */}
        <div className="pointer-events-auto flex items-center gap-1 bg-white/95 border border-slate-300 rounded-xl p-1 shadow-sm max-w-full overflow-x-auto no-scrollbar">
          <Layers className="w-3.5 h-3.5 text-slate-400 mx-1 shrink-0" />
          {project.walls.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                props.onSelectWallAndBox(w.id, null, null);
                if (camPreset === 'front') setTimeout(() => applyCameraPreset('front'), 30);
              }}
              className={`h-7 px-2 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                w.id === project.activeWallId
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {w.name}
            </button>
          ))}
          {project.doorsHidden && (
            <span className="h-7 px-2 rounded-lg bg-purple-100 text-purple-800 text-[10px] font-extrabold inline-flex items-center gap-1">
              <Eye className="w-3 h-3" />
              <span>یونیت‌ها</span>
            </span>
          )}
        </div>
      </div>

      {/* راهنمای مختصر پایین سه‌بعدی */}
      <div className="pointer-events-none absolute bottom-2.5 left-3 bg-white/95 border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] font-bold text-slate-600 shadow-xs">
        {tool === 'select'
          ? 'کلیک روی هر دیوار/باکس/درب = انتخاب و جابجایی آزاد · اسکرول/کشیدن = دوربین'
          : 'موس روی هر دیوار = پیش‌نمایش و اسکرول تغییر مدل · کلیک = اجرای مستقیم در سه‌بعدی'}
      </div>

      {hoverPreview && !drag3DRef.current && (
        <CursorToolPreview
          visible={true}
          clientX={hoverPreview.clientX}
          clientY={hoverPreview.clientY}
          tool={tool}
          hoverTarget={hoverPreview.hoverTarget}
          sinkModel={props.sinkModel}
          gasWidth={props.gasWidth}
          hoodKind={props.hoodKind}
          applianceKind={props.applianceKind}
          fridgeModel={props.fridgeModel}
          openingKind={props.openingKind}
          doorOrient={props.doorOrient}
          doorTargetWidth={props.doorTargetWidth}
          doorVertCount={props.doorVertCount}
          drawerPatIdx={props.drawerPatIdx}
          liftPatIdx={props.liftPatIdx}
          doorStyleBrush={props.doorStyleBrush}
          cabinetFinishBrush={props.cabinetFinishBrush}
          backsplashBrush={props.backsplashBrush}
          countertopBrush={props.countertopBrush}
          frameWidthCm={props.frameWidthCm}
          shelfCount={props.shelfCount}
          testId="cursor-preview-3d"
        />
      )}
    </div>
  );
};
